"""主题订阅 & 论文摄入路由
@author Color2333
"""

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from apps.api.deps import pipelines
from packages.domain.enums import ActionType
from packages.domain.exceptions import NotFoundError
from packages.domain.schemas import ReferenceImportReq, SuggestKeywordsReq, TopicCreate, TopicUpdate
from packages.domain.task_tracker import global_tracker
from packages.storage.db import session_scope
from packages.storage.repositories import PaperRepository, TopicRepository

logger = logging.getLogger(__name__)

router = APIRouter()


def _topic_dict(t, session=None) -> dict:
    d = {
        "id": t.id,
        "name": t.name,
        "query": t.query,
        "category_id": getattr(t, "category_id", None),
        "category_ids": getattr(t, "category_ids", None),
        "enabled": t.enabled,
        "max_results_per_run": t.max_results_per_run,
        "retry_limit": t.retry_limit,
        "schedule_frequency": getattr(t, "schedule_frequency", "daily"),
        "schedule_time_utc": getattr(t, "schedule_time_utc", 21),
        "enable_date_filter": getattr(t, "enable_date_filter", False),
        "date_filter_days": getattr(t, "date_filter_days", 7),
        "date_range_start": (
            drs.isoformat() if (drs := getattr(t, "date_range_start", None)) else None
        ),
        "date_range_end": (
            dre.isoformat() if (dre := getattr(t, "date_range_end", None)) else None
        ),
        "fetch_mode": getattr(t, "fetch_mode", "quantity"),
        "paper_count": 0,
        "last_run_at": None,
        "last_run_count": None,
        "last_run_status": None,
        "last_run_error": None,
    }
    if session is not None:
        from sqlalchemy import func, select

        from packages.storage.models import CollectionAction, PaperTopic, TopicFetchRun

        # 论文计数
        cnt = session.scalar(
            select(func.count()).select_from(PaperTopic).where(PaperTopic.topic_id == t.id)
        )
        d["paper_count"] = cnt or 0
        # 最近一次行动（关键词订阅用 CollectionAction，分类订阅用 TopicFetchRun）
        is_cat = getattr(t, "category_id", None) or getattr(t, "category_ids", None)
        if is_cat:
            last_run = session.execute(
                select(TopicFetchRun)
                .where(TopicFetchRun.topic_id == t.id)
                .order_by(TopicFetchRun.run_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            if last_run:
                d["last_run_at"] = last_run.run_at.isoformat() if last_run.run_at else None
                d["last_run_count"] = last_run.paper_count
                d["last_run_status"] = last_run.status
                d["last_run_error"] = last_run.error_message
        else:
            last_action = session.execute(
                select(CollectionAction)
                .where(CollectionAction.topic_id == t.id)
                .order_by(CollectionAction.created_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            if last_action:
                d["last_run_at"] = (
                    last_action.created_at.isoformat() if last_action.created_at else None
                )
                d["last_run_count"] = last_action.paper_count
                d["last_run_status"] = "completed"
    return d


@router.get("/topics/arxiv-categories")
def get_arxiv_categories() -> dict:
    """Return arXiv category taxonomy (Group -> Category)."""
    from packages.integrations.arxiv_taxonomy import get_taxonomy
    return get_taxonomy()


@router.get("/topics")
def list_topics(
    enabled_only: bool = False,
    category_only: bool = Query(default=False),
) -> dict:
    with session_scope() as session:
        topics = TopicRepository(session).list_topics(
            enabled_only=enabled_only,
            category_only=category_only,
        )
        return {"items": [_topic_dict(t, session) for t in topics]}


@router.post("/topics")
def upsert_topic(req: TopicCreate) -> dict:
    with session_scope() as session:
        topic = TopicRepository(session).upsert_topic(
            name=req.name,
            query=req.query,
            category_id=req.category_id,
            category_ids=req.category_ids,
            enabled=req.enabled,
            max_results_per_run=req.max_results_per_run,
            retry_limit=req.retry_limit,
            schedule_frequency=req.schedule_frequency,
            schedule_time_utc=req.schedule_time_utc,
            enable_date_filter=req.enable_date_filter,
            date_filter_days=req.date_filter_days,
            date_range_start=req.date_range_start if req.date_range_start else None,
            date_range_end=req.date_range_end if req.date_range_end else None,
            fetch_mode=req.fetch_mode or "quantity",
        )
        return _topic_dict(topic, session)


@router.post("/topics/suggest-keywords")
def suggest_keywords(req: SuggestKeywordsReq) -> dict:
    from packages.ai.keyword_service import KeywordService

    description = req.description
    if not description.strip():
        raise HTTPException(400, "description is required")
    suggestions = KeywordService().suggest(description.strip())
    return {"suggestions": suggestions}


@router.patch("/topics/{topic_id}")
def update_topic(topic_id: str, req: TopicUpdate) -> dict:
    with session_scope() as session:
        try:
            topic = TopicRepository(session).update_topic(
                topic_id,
                query=req.query,
                category_id=req.category_id,
                category_ids=req.category_ids,
                enabled=req.enabled,
                max_results_per_run=req.max_results_per_run,
                retry_limit=req.retry_limit,
                schedule_frequency=req.schedule_frequency,
                schedule_time_utc=req.schedule_time_utc,
                enable_date_filter=req.enable_date_filter,
                date_filter_days=req.date_filter_days,
                date_range_start=req.date_range_start,
                date_range_end=req.date_range_end,
                fetch_mode=req.fetch_mode,
            )
        except ValueError as exc:
            raise NotFoundError(str(exc)) from exc
        return _topic_dict(topic, session)


@router.delete("/topics/{topic_id}")
def delete_topic(topic_id: str) -> dict:
    with session_scope() as session:
        TopicRepository(session).delete_topic(topic_id)
        return {"deleted": topic_id}


@router.post("/topics/{topic_id}/fetch")
def manual_fetch_topic(topic_id: str) -> dict:
    """手动触发单个订阅的论文抓取（后台执行，立即返回）

    每日论文（分类订阅）：仅抓取，保存至运行历史，用户手动勾选入库
    自动订阅（关键词）：抓取并自动入库
    """
    from packages.ai.daily_runner import run_topic_fetch, run_topic_ingest
    from packages.storage.models import TopicSubscription

    with session_scope() as session:
        topic = session.get(TopicSubscription, topic_id)
        if not topic:
            raise NotFoundError("订阅不存在")
        topic_name = topic.name
        is_category = bool(
            getattr(topic, "category_id", None)
            or getattr(topic, "category_ids", None)
        )

    def _fetch_fn(progress_callback=None):
        if is_category:
            return run_topic_fetch(topic_id, progress_callback=progress_callback)
        return run_topic_ingest(topic_id)

    task_id = global_tracker.submit(
        task_type="fetch",
        title=f"抓取: {topic_name[:30]}",
        fn=_fetch_fn,
        topic_id=topic_id,
        total=500 if is_category else 10,
    )
    return {
        "status": "started",
        "task_id": task_id,
        "topic_id": topic_id,
        "topic_name": topic_name,
        "is_category": is_category,
        "message": f"「{topic_name}」抓取已在后台启动",
    }


@router.get("/topics/{topic_id}/fetch-status")
def fetch_topic_status(topic_id: str) -> dict:
    """查询手动抓取的执行状态 — 通过全局 tracker 查询"""
    active = global_tracker.get_active()
    for t in active:
        if t["task_type"] == "fetch" and t.get("topic_id") == topic_id:
            if t["finished"]:
                result = {"status": "completed" if t["success"] else "failed", **t}
                fn_result = global_tracker.get_result(t.get("task_id", ""))
                if isinstance(fn_result, dict):
                    result_keys = {"run_id", "paper_count", "inserted", "error"}
                    result.update(
                        {k: v for k, v in fn_result.items() if k in result_keys}
                    )
                return result
            return {"status": "running", **t}
    with session_scope() as session:
        from packages.storage.models import TopicSubscription

        topic = session.get(TopicSubscription, topic_id)
        topic_info = _topic_dict(topic, session) if topic else {}
    return {"topic": topic_info}


# ---------- 每日论文运行历史 ----------


@router.get("/topics/{topic_id}/runs")
def list_topic_runs(topic_id: str, limit: int = Query(default=50, le=100)) -> dict:
    """列出某订阅的抓取运行历史"""
    from packages.storage.repositories import TopicFetchRunRepository

    with session_scope() as session:
        runs = TopicFetchRunRepository(session).list_by_topic(topic_id, limit=limit)
        items = [
            {
                "id": r.id,
                "topic_id": r.topic_id,
                "run_at": r.run_at.isoformat() if r.run_at else None,
                "query": r.query,
                "fetch_mode": r.fetch_mode,
                "date_range_start": (
                    r.date_range_start.isoformat() if r.date_range_start else None
                ),
                "date_range_end": (
                    r.date_range_end.isoformat() if r.date_range_end else None
                ),
                "status": r.status,
                "paper_count": r.paper_count,
                "error_message": r.error_message,
            }
            for r in runs
        ]
        return {"items": items}


@router.get("/topic-runs/{run_id}")
def get_topic_run(run_id: str) -> dict:
    """获取单次运行的详情（含论文列表）"""
    from packages.domain.exceptions import NotFoundError
    from packages.storage.repositories import TopicFetchRunRepository

    with session_scope() as session:
        run = TopicFetchRunRepository(session).get_by_id(run_id)
        if not run:
            raise NotFoundError("运行记录不存在")

        existing_ids: set[str] = set()
        if run.papers_json:
            arxiv_ids = [p.get("arxiv_id") for p in run.papers_json if p.get("arxiv_id")]
            if arxiv_ids:
                existing_ids = PaperRepository(session).list_existing_arxiv_ids(
                    arxiv_ids
                )

        papers = []
        for p in run.papers_json or []:
            arxiv_id = p.get("arxiv_id")
            papers.append({
                **p,
                "already_ingested": arxiv_id in existing_ids if arxiv_id else False,
            })

        return {
            "id": run.id,
            "topic_id": run.topic_id,
            "run_at": run.run_at.isoformat() if run.run_at else None,
            "query": run.query,
            "fetch_mode": run.fetch_mode,
            "date_range_start": (
                run.date_range_start.isoformat() if run.date_range_start else None
            ),
            "date_range_end": (
                run.date_range_end.isoformat() if run.date_range_end else None
            ),
            "status": run.status,
            "paper_count": run.paper_count,
            "papers": papers,
            "error_message": run.error_message,
        }


class IngestRunPapersReq(BaseModel):
    arxiv_ids: list[str]


@router.delete("/topic-runs/{run_id}")
def delete_topic_run(run_id: str) -> dict:
    """Delete a fetch run record."""
    from packages.domain.exceptions import NotFoundError
    from packages.storage.repositories import TopicFetchRunRepository

    with session_scope() as session:
        deleted = TopicFetchRunRepository(session).delete(run_id)
        if not deleted:
            raise NotFoundError("运行记录不存在")
    return {"deleted": run_id}


@router.post("/topic-runs/{run_id}/ingest")
def ingest_run_papers(run_id: str, req: IngestRunPapersReq) -> dict:
    """将运行历史中选中的论文入库。优先使用 run 的 papers_json（含 metadata/categories），
    避免重复请求 arXiv。若 run 中无对应论文则回退到 fetch_by_ids。"""
    from packages.domain.exceptions import NotFoundError
    from packages.storage.repositories import TopicFetchRunRepository

    with session_scope() as session:
        run = TopicFetchRunRepository(session).get_by_id(run_id)
        if not run:
            raise NotFoundError("运行记录不存在")
        topic_id = run.topic_id
        papers_data = list(run.papers_json or [])

    arxiv_ids = req.arxiv_ids or []
    if not arxiv_ids:
        return {"ingested": 0, "papers": []}
    if papers_data:
        count, inserted_ids = pipelines.ingest_from_run_papers(
            papers_data=papers_data,
            arxiv_ids=arxiv_ids,
            topic_id=topic_id,
            action_type=ActionType.manual_collect,
        )
    else:
        count, inserted_ids = pipelines.ingest_by_arxiv_ids(
            arxiv_ids=arxiv_ids,
            topic_id=topic_id,
            action_type=ActionType.manual_collect,
        )
    papers_info = []
    if inserted_ids:
        with session_scope() as session:
            repo = PaperRepository(session)
            for pid in inserted_ids[:50]:
                try:
                    p = repo.get_by_id(UUID(pid))
                    papers_info.append({
                        "id": p.id,
                        "title": p.title,
                        "arxiv_id": p.arxiv_id,
                        "publication_date": (
                            p.publication_date.isoformat()
                            if p.publication_date
                            else None
                        ),
                    })
                except Exception:
                    pass
    return {"ingested": count, "papers": papers_info}


# ---------- 摄入 ----------


@router.get("/ingest/arxiv/search")
def search_arxiv(
    query: str,
    max_results: int = Query(default=20, ge=1, le=200),
    sort_by: str = Query(
        default="submittedDate", pattern="^(submittedDate|relevance|lastUpdatedDate)$"
    ),
) -> dict:
    """Search arXiv without ingesting. Returns papers with already_ingested flag."""
    papers = pipelines.fetch_arxiv_only(
        query=query,
        max_results=max_results,
        sort_by=sort_by,
    )
    if not papers:
        return {"papers": [], "query": query}

    arxiv_ids = [p.arxiv_id for p in papers]
    with session_scope() as session:
        repo = PaperRepository(session)
        existing = repo.list_existing_arxiv_ids(arxiv_ids)
        # Build arxiv_id -> paper_id map for already ingested
        id_map: dict[str, str] = {}
        if existing:
            from sqlalchemy import select

            from packages.storage.models import Paper
            rows = session.execute(
                select(Paper.id, Paper.arxiv_id).where(Paper.arxiv_id.in_(arxiv_ids))
            ).all()
            id_map = {r[1]: str(r[0]) for r in rows}

    items = []
    for p in papers:
        ingested = p.arxiv_id in existing
        items.append({
            "arxiv_id": p.arxiv_id,
            "title": p.title,
            "abstract": p.abstract or "",
            "publication_date": p.publication_date.isoformat() if p.publication_date else None,
            "metadata": p.metadata or {},
            "already_ingested": ingested,
            "paper_id": id_map.get(p.arxiv_id) if ingested else None,
        })
    return {"papers": items, "query": query}


class IngestSelectedReq(BaseModel):
    arxiv_ids: list[str]
    topic_id: str | None = None


@router.post("/ingest/arxiv/selected")
def ingest_arxiv_selected(req: IngestSelectedReq) -> dict:
    """Ingest selected papers by arxiv_ids (from search results)."""
    arxiv_ids = req.arxiv_ids or []
    if not arxiv_ids:
        return {"ingested": 0, "papers": []}
    count, inserted_ids = pipelines.ingest_by_arxiv_ids(
        arxiv_ids=arxiv_ids,
        topic_id=req.topic_id,
        action_type=ActionType.manual_collect,
    )
    papers_info = []
    if inserted_ids:
        with session_scope() as session:
            repo = PaperRepository(session)
            for pid in inserted_ids[:50]:
                try:
                    p = repo.get_by_id(UUID(pid))
                    papers_info.append({
                        "id": str(p.id),
                        "title": p.title,
                        "arxiv_id": p.arxiv_id,
                        "publication_date": (
                            p.publication_date.isoformat()
                            if p.publication_date
                            else None
                        ),
                    })
                except Exception:
                    pass
    return {"ingested": count, "papers": papers_info}


@router.post("/ingest/arxiv")
def ingest_arxiv(
    query: str,
    max_results: int = Query(default=20, ge=1, le=200),
    topic_id: str | None = None,
    sort_by: str = Query(
        default="submittedDate", pattern="^(submittedDate|relevance|lastUpdatedDate)$"
    ),
) -> dict:
    logger.info("ArXiv ingest: query=%r max_results=%d sort=%s", query, max_results, sort_by)
    count, inserted_ids, _ = pipelines.ingest_arxiv(
        query=query,
        max_results=max_results,
        topic_id=topic_id,
        sort_by=sort_by,
    )
    # 查询插入论文的基本信息
    papers_info: list[dict] = []
    if inserted_ids:
        with session_scope() as session:
            repo = PaperRepository(session)
            for pid in inserted_ids[:50]:
                try:
                    p = repo.get_by_id(UUID(pid))
                    papers_info.append(
                        {
                            "id": p.id,
                            "title": p.title,
                            "arxiv_id": p.arxiv_id,
                            "publication_date": p.publication_date.isoformat()
                            if p.publication_date
                            else None,
                        }
                    )
                except Exception:
                    pass
    return {"ingested": count, "papers": papers_info}


@router.post("/ingest/references")
def ingest_references(body: ReferenceImportReq) -> dict:
    """一键导入参考文献 — 返回 task_id 用于轮询进度"""
    from packages.ai.pipelines import ReferenceImporter

    importer = ReferenceImporter()
    task_id = importer.start_import(
        source_paper_id=body.source_paper_id,
        source_paper_title=body.source_paper_title,
        entries=[dict(e) for e in body.entries],
        topic_ids=body.topic_ids,
    )
    return {"task_id": task_id, "total": len(body.entries)}


@router.get("/ingest/references/status/{task_id}")
def ingest_references_status(task_id: str) -> dict:
    """查询参考文献导入任务进度"""
    from packages.ai.pipelines import get_import_task

    task = get_import_task(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task
