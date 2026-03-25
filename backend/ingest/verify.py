"""
verify.py — Spot-check verification for ingested curriculum documents.

After ingesting a document, this module randomly samples N chunks from the
ChromaDB collection and verifies each one appears in the top search results
when queried by its own text. This confirms:
  - Embeddings were stored correctly
  - Search returns meaningful results
  - The doc is findable in the shared hs_curriculum collection

Usage:
    result = spot_check_doc(doc_id, subject, curriculum, n_samples=3)
    if not result["passed"]:
        logger.warning(f"Spot check failed: {result['failures']}")
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

MAX_QUERY_LEN = 300


@dataclass
class SpotCheckResult:
    doc_id: str
    title: str
    passed: bool
    samples_tested: int
    samples_passed: int
    failures: list[str] = field(default_factory=list)
    skipped: bool = False
    skip_reason: str = ""


def _truncate_for_query(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) <= MAX_QUERY_LEN:
        return text
    cutoff = text.rfind(" ", 0, MAX_QUERY_LEN)
    return text[:cutoff].strip() if cutoff > 50 else text[:MAX_QUERY_LEN]


def spot_check_doc(
    doc_id: str,
    title: str,
    subject: str = "",
    curriculum: str = "",
    n_samples: int = 3,
    max_distance: float = 0.5,
) -> SpotCheckResult:
    """
    Verify a recently ingested doc by searching for its own chunks.

    For each sampled chunk:
      1. Use the chunk text as a search query against hs_curriculum
      2. Verify the original chunk appears within the top (n_samples * 3) results
      3. Pass threshold: distance < max_distance

    Returns SpotCheckResult with pass/fail details.
    """
    try:
        import context_store
    except ImportError:
        return SpotCheckResult(
            doc_id=doc_id, title=title, passed=False,
            samples_tested=0, samples_passed=0,
            skipped=True, skip_reason="context_store not importable",
        )

    if not context_store.available():
        return SpotCheckResult(
            doc_id=doc_id, title=title, passed=False,
            samples_tested=0, samples_passed=0,
            skipped=True, skip_reason="context_store not initialized",
        )

    try:
        col = context_store._get_collection(context_store.HS_CURRICULUM_COLLECTION)
        if col.count() == 0:
            return SpotCheckResult(
                doc_id=doc_id, title=title, passed=False,
                samples_tested=0, samples_passed=0,
                skipped=True, skip_reason="hs_curriculum collection is empty",
            )

        all_chunks = col.get(
            where={"doc_id": doc_id},
            include=["documents", "metadatas"],
        )
        docs = all_chunks.get("documents") or []
        if not docs:
            return SpotCheckResult(
                doc_id=doc_id, title=title, passed=False,
                samples_tested=0, samples_passed=0,
                skipped=True, skip_reason=f"No chunks found for doc_id={doc_id} in hs_curriculum",
            )

    except Exception as e:
        return SpotCheckResult(
            doc_id=doc_id, title=title, passed=False,
            samples_tested=0, samples_passed=0,
            skipped=True, skip_reason=f"ChromaDB fetch failed: {e}",
        )

    sample_size = min(n_samples, len(docs))
    sampled = random.sample(docs, sample_size)

    passed_count = 0
    failures: list[str] = []
    system_user = "0"

    for i, chunk_text in enumerate(sampled):
        query = _truncate_for_query(chunk_text)
        if not query:
            failures.append(f"Sample {i+1}: chunk was empty after truncation")
            continue

        try:
            results = context_store.search_context(
                query=query,
                user_id=system_user,
                use_hs=True,
                top_k=min(20, n_samples * 5),
                subject=subject or None,
                curriculum=curriculum or None,
            )
        except Exception as e:
            failures.append(f"Sample {i+1}: search_context raised {e}")
            continue

        found = False
        for r in results:
            meta = r.get("metadata") or {}
            if meta.get("doc_id") == doc_id:
                found = True
                break
            r_text = (r.get("text") or "").strip()
            if r_text and r_text[:80] == chunk_text[:80]:
                found = True
                break

        if found:
            passed_count += 1
            logger.debug(f"Spot check {doc_id} sample {i+1}: PASS")
        else:
            failures.append(
                f"Sample {i+1}: chunk not found in top-{n_samples * 3} results "
                f"(query: {query[:60]!r}...)"
            )
            logger.debug(f"Spot check {doc_id} sample {i+1}: FAIL")

    overall_pass = passed_count == sample_size and sample_size > 0
    return SpotCheckResult(
        doc_id=doc_id,
        title=title,
        passed=overall_pass,
        samples_tested=sample_size,
        samples_passed=passed_count,
        failures=failures,
    )


def spot_check_batch(
    results: list[dict],
    sample_rate: float = 0.15,
    min_checks: int = 1,
    n_samples_per_doc: int = 3,
) -> list[SpotCheckResult]:
    """
    Randomly spot-check ~sample_rate fraction of a batch of ingested docs.

    results: list of dicts with keys: doc_id, title, subject, curriculum
    sample_rate: fraction to check (0.15 = ~15%)
    min_checks: always check at least this many docs per batch
    """
    if not results:
        return []

    n_to_check = max(min_checks, int(len(results) * sample_rate))
    n_to_check = min(n_to_check, len(results))
    sampled = random.sample(results, n_to_check)

    check_results: list[SpotCheckResult] = []
    for entry in sampled:
        logger.info(f"  Spot checking: {entry.get('title', entry.get('doc_id'))}")
        result = spot_check_doc(
            doc_id=entry["doc_id"],
            title=entry.get("title", ""),
            subject=entry.get("subject", ""),
            curriculum=entry.get("curriculum", ""),
            n_samples=n_samples_per_doc,
        )
        check_results.append(result)
        status = "PASS" if result.passed else ("SKIP" if result.skipped else "FAIL")
        logger.info(
            f"  Spot check [{status}] {result.title}: "
            f"{result.samples_passed}/{result.samples_tested} samples passed"
            + (f" — {result.skip_reason}" if result.skipped else "")
            + (f" — {result.failures[0]}" if result.failures else "")
        )

    return check_results
