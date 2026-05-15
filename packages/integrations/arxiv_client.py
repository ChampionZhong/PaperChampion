from __future__ import annotations

import logging
import re
import time
import xml.etree.ElementTree as ElementTree
from collections.abc import Callable
from datetime import date, datetime, timedelta

import httpx

from packages.ai.rate_limiter import acquire_api, record_rate_limit_error, release_api
from packages.config import get_settings
from packages.domain.schemas import PaperCreate

ARXIV_API_URL = "https://export.arxiv.org/api/query"
logger = logging.getLogger(__name__)


def _build_arxiv_query(raw: str, days_back: int = 7) -> str:
    """将用户输入转换为 ArXiv API 查询语法

    - 已是结构化查询（含 all:/ti: 等）直接返回
    - 否则按空格拆分，取前 3 个关键词用 AND 连接（避免 429）
    - 当 days_back > 0 时自动添加最近 N 天的日期范围过滤
    """
    raw = raw.strip()
    if not raw:
        return raw
    # 日期过滤（days_back <= 0 时不添加）
    date_filter = ""
    if days_back > 0:
        from_date = datetime.now() - timedelta(days=days_back)
        date_filter = f" AND submittedDate:[{from_date.strftime('%Y%m%d')}000000 TO *]"

    if re.search(r"\b(all|ti|au|abs|cat|co|jr|rn|id):", raw):
        # 已经是结构化查询，检查是否已有日期过滤
        if "submittedDate:" not in raw:
            return raw + date_filter
        return raw
    # 拆分词汇，跳过短词（<2 字符），最多取 3 个
    tokens = [t.strip() for t in raw.split() if len(t.strip()) >= 2]
    if not tokens:
        return f"all:{raw}"
    tokens = tokens[:3]
    return " AND ".join(f"all:{t}" for t in tokens) + date_filter


class ArxivClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: httpx.Client | None = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(timeout=60, follow_redirects=True)
        return self._client

    def fetch_latest(
        self,
        query: str,
        max_results: int = 20,
        sort_by: str = "submittedDate",
        start: int = 0,
        days_back: int = 7,
        progress_callback: Callable[[str], None] | None = None,
    ) -> list[PaperCreate]:
        """sort_by: submittedDate(最新) / relevance(相关性) / lastUpdatedDate"""
        # 获取速率限制许可（10 秒超时）
        if not acquire_api("arxiv", timeout=10.0):
            raise httpx.TimeoutException("ArXiv 速率限制等待超时，请稍后重试")

        try:
            structured_query = _build_arxiv_query(query, days_back)
            logger.info(
                "ArXiv search: %s → %s (sort=%s start=%d days_back=%d)",
                query,
                structured_query,
                sort_by,
                start,
                days_back,
            )
            params = {
                "search_query": structured_query,
                "sortBy": sort_by,
                "sortOrder": "descending",
                "start": start,
                "max_results": max_results,
            }
            # 自动重试（429 限流 + 网络抖动 + 500 回退）
            last_exc: Exception | None = None
            max_retries = 6  # 429 时最多重试 6 次
            for attempt in range(max_retries):
                try:
                    response = self.client.get(ARXIV_API_URL, params=params)
                    response.raise_for_status()
                    return self._parse_atom(response.text)
                except httpx.HTTPStatusError as exc:
                    last_exc = exc
                    status = exc.response.status_code
                    if status == 429:
                        record_rate_limit_error("arxiv")
                        # 优先使用 Retry-After，否则指数退避：30s, 60s, 120s, 240s, 480s
                        retry_after = exc.response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                wait = int(retry_after)
                            except ValueError:
                                wait = 30 * (2**min(attempt, 4))
                        else:
                            wait = 30 * (2**min(attempt, 4))
                        wait = min(wait, 600)  # 最多等 10 分钟
                        logger.warning(
                            "ArXiv 429 限流 (attempt %d/%d)，等待 %ds 后重试...",
                            attempt + 1,
                            max_retries,
                            wait,
                        )
                        if progress_callback:
                            progress_callback(
                                f"ArXiv rate limit; retrying in {wait}s "
                                f"({attempt + 1}/{max_retries})"
                            )
                        time.sleep(wait)
                        continue
                    elif status == 500 and "submittedDate:" in structured_query:
                        # arXiv API 日期过滤可能有问题，尝试不带日期的查询
                        logger.warning("ArXiv 500 错误（可能是日期过滤问题），尝试不带日期的查询")
                        simple_query = _build_arxiv_query(query, days_back=0)  # 不添加日期
                        params["search_query"] = simple_query
                        response = self.client.get(ARXIV_API_URL, params=params)
                        response.raise_for_status()
                        return self._parse_atom(response.text)
                    raise
                except httpx.TimeoutException as exc:
                    last_exc = exc
                    logger.warning("ArXiv 请求超时 (attempt %d/%d)", attempt + 1, max_retries)
                    time.sleep(5 * (attempt + 1))
                    continue
            raise last_exc or RuntimeError("ArXiv fetch failed")
        finally:
            release_api("arxiv")

    _FETCH_BY_IDS_BATCH = 100  # arXiv GET URL length limit; batch to avoid 400

    def fetch_by_ids(self, arxiv_ids: list[str]) -> list[PaperCreate]:
        """按 arXiv ID 列表批量获取论文元数据。分批请求避免 URL 过长导致 400。"""
        if not arxiv_ids:
            return []
        clean_ids = [aid.split("v")[0] if "v" in aid else aid for aid in arxiv_ids]
        seen: set[str] = set()
        results: list[PaperCreate] = []
        for i in range(0, len(clean_ids), self._FETCH_BY_IDS_BATCH):
            batch = clean_ids[i : i + self._FETCH_BY_IDS_BATCH]
            batch_results = self._fetch_by_ids_single(batch)
            for p in batch_results:
                if p.arxiv_id not in seen:
                    seen.add(p.arxiv_id)
                    results.append(p)
            if i + self._FETCH_BY_IDS_BATCH < len(clean_ids):
                time.sleep(1)  # Rate limit between batches
        return results

    def _fetch_by_ids_single(self, clean_ids: list[str]) -> list[PaperCreate]:
        """Single batch fetch by IDs."""
        id_list = ",".join(clean_ids)
        params = {"id_list": id_list, "max_results": len(clean_ids)}

        if not acquire_api("arxiv", timeout=10.0):
            raise httpx.TimeoutException("ArXiv 速率限制等待超时，请稍后重试")

        try:
            last_exc: Exception | None = None
            max_retries = 6
            for attempt in range(max_retries):
                try:
                    resp = self.client.get(ARXIV_API_URL, params=params)
                    resp.raise_for_status()
                    return self._parse_atom(resp.text)
                except httpx.HTTPStatusError as exc:
                    last_exc = exc
                    if exc.response.status_code == 429:
                        record_rate_limit_error("arxiv")
                        retry_after = exc.response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                wait = min(int(retry_after), 600)
                            except ValueError:
                                wait = 30 * (2**min(attempt, 4))
                        else:
                            wait = min(30 * (2**min(attempt, 4)), 600)
                        logger.warning(
                            "ArXiv 429 限流 (attempt %d/%d)，等待 %ds 后重试...",
                            attempt + 1,
                            max_retries,
                            wait,
                        )
                        time.sleep(wait)
                        continue
                    raise
                except httpx.TimeoutException as exc:
                    last_exc = exc
                    logger.warning("ArXiv 请求超时 (attempt %d/%d)", attempt + 1, max_retries)
                    time.sleep(5 * (attempt + 1))
                    continue
            raise last_exc or RuntimeError("ArXiv fetch_by_ids failed")
        finally:
            release_api("arxiv")

    def download_pdf(self, arxiv_id: str) -> str:
        """下载 PDF 到本地存储"""
        url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        target = self.settings.pdf_storage_root / f"{arxiv_id}.pdf"
        target.parent.mkdir(parents=True, exist_ok=True)

        # PDF 下载不经过速率限制器（因为是直接下载，不是 API 查询）
        response = self.client.get(url, timeout=90)
        response.raise_for_status()
        target.write_bytes(response.content)
        return str(target)

    def _parse_atom(self, payload: str) -> list[PaperCreate]:
        root = ElementTree.fromstring(payload)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        papers: list[PaperCreate] = []
        for entry in root.findall("atom:entry", ns):
            id_text = self._text(entry, "atom:id", ns)
            if not id_text:
                continue
            arxiv_id = id_text.rsplit("/", 1)[-1]
            title = self._text(entry, "atom:title", ns).replace("\n", " ").strip()
            summary = self._text(entry, "atom:summary", ns).strip()
            published_raw = self._text(entry, "atom:published", ns)
            published: date | None = None
            if published_raw:
                published = datetime.fromisoformat(published_raw.replace("Z", "+00:00")).date()

            # Parse atom:updated (last update time) for date-range filtering
            updated_raw = self._text(entry, "atom:updated", ns)
            updated_dt: datetime | None = None
            if updated_raw:
                try:
                    updated_dt = datetime.fromisoformat(
                        updated_raw.replace("Z", "+00:00")
                    )
                except ValueError:
                    pass

            # 解析 ArXiv categories（如 cs.CV, cs.LG, stat.ML）
            categories: list[str] = []
            for cat_el in entry.findall("atom:category", ns):
                term = cat_el.get("term")
                if term:
                    categories.append(term)

            # 解析作者列表
            authors: list[str] = []
            for author_el in entry.findall("atom:author", ns):
                name = self._text(author_el, "atom:name", ns)
                if name:
                    authors.append(name)

            meta: dict = {
                "source": "arxiv",
                "categories": categories,
                "authors": authors,
                "primary_category": categories[0] if categories else None,
            }
            if updated_dt is not None:
                meta["updated"] = updated_dt.isoformat()

            papers.append(
                PaperCreate(
                    arxiv_id=arxiv_id,
                    title=title,
                    abstract=summary,
                    publication_date=published,
                    metadata=meta,
                )
            )
        return papers

    @staticmethod
    def _text(entry: ElementTree.Element, path: str, ns: dict[str, str]) -> str:
        node = entry.find(path, ns)
        return node.text if node is not None and node.text else ""
