"""
Research tag classifier - LLM-based paper categorization.
Classifies papers by title + abstract into predefined research tags.
@author Bamzc
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from packages.integrations.llm_client import LLMClient
from packages.storage.db import session_scope
from packages.storage.repositories import PaperRepository

logger = logging.getLogger(__name__)

# Predefined research tags for paper classification
# "Other" is mutually exclusive; other tags support multi-select
RESEARCH_TAGS = [
    "LLM",
    "LLM Agent",
    "Multi-Model LLM",
    "Diffusion Model",
    "AI4Science",
    "Embodied AI",
    "Robotics",
    "Other",
]


def _build_classify_prompt(title: str, abstract: str) -> str:
    tags_str = ", ".join(f'"{t}"' for t in RESEARCH_TAGS)
    return (
        "You are a research paper classifier. Given a paper's title and abstract, "
        "assign research tags from the following list.\n\n"
        "Rules:\n"
        "- All tags except \"Other\" support multi-select: a paper can have multiple tags "
        "(e.g. [\"LLM\", \"LLM Agent\"]).\n"
        "- \"Other\" is mutually exclusive: use it ONLY when the paper does not fit any "
        "specific category. When using \"Other\", output only [\"Other\"] with no other tags.\n"
        "- If the paper clearly fits one or more specific tags, do NOT use \"Other\".\n\n"
        f"Available tags: {tags_str}\n\n"
        f"Title: {title[:500]}\n\n"
        f"Abstract: {abstract[:2000]}\n\n"
        "Output a JSON object with a single key \"tags\" (array of strings). "
        "Example: {\"tags\": [\"LLM\", \"LLM Agent\"]} or {\"tags\": [\"Other\"]}"
    )


def classify_paper(title: str, abstract: str) -> list[str]:
    """
    Classify a single paper by title and abstract. Returns list of research tags.

    Args:
        title: Paper title
        abstract: Paper abstract

    Returns:
        List of tag strings from RESEARCH_TAGS
    """
    if not title and not abstract:
        return []
    llm = LLMClient()
    prompt = _build_classify_prompt(title or "", abstract or "")
    result = llm.complete_json(
        prompt,
        stage="research_tag",
        max_tokens=128,
    )
    tags: list[str] = []
    if result.parsed_json:
        raw = result.parsed_json.get("tags")
        if isinstance(raw, list):
            for t in raw:
                if isinstance(t, str) and t.strip() in RESEARCH_TAGS:
                    tags.append(t.strip())
        elif isinstance(raw, str) and raw.strip() in RESEARCH_TAGS:
            tags.append(raw.strip())
        # "Other" is mutually exclusive: if present, return only ["Other"]
        if "Other" in tags:
            return ["Other"]
    return tags


def classify_and_save_paper(paper_id: str, title: str, abstract: str) -> None:
    """
    Classify a paper and persist research_tags to metadata. Safe to call from threads.

    Args:
        paper_id: Paper UUID string
        title: Paper title
        abstract: Paper abstract
    """
    try:
        tags = classify_paper(title, abstract)
        with session_scope() as session:
            repo = PaperRepository(session)
            repo.set_research_tags(paper_id, tags)
        logger.info("Classified paper %s: %s", paper_id[:8], tags)
    except Exception as exc:
        logger.warning(
            "Research tag classification failed for %s: %s: %s",
            paper_id[:8],
            type(exc).__name__,
            exc,
        )


def classify_papers_concurrent(
    items: list[tuple[str, str, str]],
    max_workers: int = 4,
) -> None:
    """
    Classify multiple papers concurrently and save tags to DB.

    Args:
        items: List of (paper_id, title, abstract) tuples
        max_workers: Max concurrent LLM calls
    """
    if not items:
        return
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(classify_and_save_paper, pid, t, a): pid
            for pid, t, a in items
        }
        for fut in as_completed(futures):
            pid = futures[fut]
            try:
                fut.result()
            except Exception as exc:
                logger.warning("Concurrent classify failed for %s: %s", pid[:8], exc)
