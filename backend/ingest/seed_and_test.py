from __future__ import annotations
import os, sys, time, textwrap
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import logging
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")

DEMO_BOOKS = [
    {
        "slug": "biology-2e",
        "title": "Biology 2e",
        "subject": "Biology",
        "grade_level": "AP",
        "curriculum": "us",
        "source_type": "direct",
        "source_name": "OpenStax",
        "license": "CC-BY 4.0",
        "page_url": "https://openstax.org/details/books/biology-2e",
        "direct_url": "https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf",
    },
    {
        "slug": "college-physics-2e",
        "title": "College Physics 2e",
        "subject": "Physics",
        "grade_level": "AP",
        "curriculum": "us",
        "source_type": "direct",
        "source_name": "OpenStax",
        "license": "CC-BY 4.0",
        "page_url": "https://openstax.org/details/books/college-physics-2e",
        "direct_url": "https://assets.openstax.org/oscms-prodcms/media/documents/College_Physics_2e-WEB.pdf",
    },
    {
        "slug": "calculus-volume-1",
        "title": "Calculus Volume 1",
        "subject": "Calculus",
        "grade_level": "AP",
        "curriculum": "us",
        "source_type": "direct",
        "source_name": "OpenStax",
        "license": "CC-BY 4.0",
        "page_url": "https://archive.org/details/calculus-volume-1",
        "direct_url": "https://archive.org/download/calculus-volume-1/Calculus%2C%20Volume%201.pdf",
    },
    {
        "slug": "introductory-statistics",
        "title": "Introductory Statistics",
        "subject": "Statistics",
        "grade_level": "AP",
        "curriculum": "us",
        "source_type": "direct",
        "source_name": "OpenStax",
        "license": "CC-BY 4.0",
        "page_url": "https://openstax.org/details/books/introductory-statistics",
        "direct_url": "https://assets.openstax.org/oscms-prodcms/media/documents/Statistics-WEB.pdf",
    },
]

QUERIES = [
    ("Biology",    "What is photosynthesis and how does it produce glucose from sunlight?"),
    ("Biology",    "Explain the structure of DNA and how base pairing works in the double helix"),
    ("Biology",    "What is mitosis? Describe the phases: prophase, metaphase, anaphase, telophase"),
    ("Biology",    "How does natural selection drive evolution? Explain Darwin's theory"),
    ("Physics",    "State Newton's three laws of motion with examples"),
    ("Physics",    "What is the relationship between electric field and Coulomb's law?"),
    ("Physics",    "Explain kinetic energy and the work-energy theorem"),
    ("Calculus",   "What is a derivative and how do you find the derivative using the power rule?"),
    ("Calculus",   "What is the fundamental theorem of calculus?"),
    ("Calculus",   "Explain limits: what does lim x->0 of sin(x)/x equal and why?"),
    ("Statistics", "What is the central limit theorem and why does it matter?"),
    ("Statistics", "Explain the difference between type I and type II errors in hypothesis testing"),
    (None,         "What is osmosis and how does it work across a semi-permeable membrane?"),
    (None,         "Explain entropy and the second law of thermodynamics"),
]

def hr(char="-", n=72): print(char * n)

def setup():
    print("Initializing embedding model (all-MiniLM-L6-v2)...")
    from sentence_transformers import SentenceTransformer
    import vector_store, context_store, redis_cache
    model = SentenceTransformer("all-MiniLM-L6-v2")
    vector_store.initialize(model)
    try:
        redis_cache.init_redis()
    except Exception:
        pass
    print("Vector store ready.\n")
    return context_store

def ingest_books(context_store):
    from ingest.pipeline import IngestPipeline
    from database import SessionLocal

    pipeline = IngestPipeline(dry_run=False, resume=True)
    pipeline._state = {}

    import vector_store as vs
    already = set()
    try:
        rows = vs.get_by_metadata("hs_curriculum", {"chunk_index": "0"})
        for r in rows:
            already.add(r["metadata"].get("doc_id", ""))
    except Exception:
        pass

    import uuid
    db = SessionLocal()
    try:
        sys_uid = pipeline._get_system_user_id(db)
    finally:
        db.close()

    hr("=")
    print("  PHASE 1 — INGESTING BOOKS")
    hr("=")

    for entry in DEMO_BOOKS:
        slug = entry["slug"]
        doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"brainwave_ingest:{slug}"))

        if doc_id in already:
            print(f"  [SKIP] {entry['title']} — already in DB")
            continue

        print(f"\n  Downloading: {entry['title']}")
        t0 = time.time()
        db2 = SessionLocal()
        try:
            result = pipeline.ingest_one(entry, db2)
        finally:
            db2.close()

        elapsed = time.time() - t0
        if result.success:
            print(f"  [OK] {result.title} — {result.chunk_count} chunks, {elapsed:.0f}s")
        else:
            print(f"  [FAIL] {result.title}: {result.error}")

def run_queries(context_store):
    hr("=")
    print("  PHASE 2 — RETRIEVAL TESTS WITH PAGE NUMBERS")
    hr("=")

    stats = context_store.get_hs_stats()
    print(f"\n  DB: {stats.get('total_docs',0)} docs, {stats.get('total_chunks',0):,} chunks indexed")
    subjects_in_db = stats.get("by_subject", {})
    if subjects_in_db:
        print("  Subjects: " + ", ".join(f"{s}({n})" for s, n in sorted(subjects_in_db.items())))
    print()

    passed = 0
    failed = 0

    for subject, query in QUERIES:
        print()
        hr()
        print(f"  QUERY ({subject or 'no filter'}): {query}")
        hr()

        results = context_store.search_context(
            query=query,
            user_id="0",
            use_hs=True,
            top_k=3,
            subject=subject,
        )

        if not results:
            print("  FAIL:NO RESULTS RETURNED")
            failed += 1
            continue

        all_have_pages = True
        for i, r in enumerate(results, 1):
            meta = r.get("metadata", {})
            book  = meta.get("book_title") or meta.get("filename", "?")
            page  = meta.get("page_number") or meta.get("page_start") or "?"
            pend  = meta.get("page_end", "")
            subj  = meta.get("subject", "?")
            src   = meta.get("source_name", "")
            text  = (r.get("text") or "").strip()

            page_label = f"p.{page}" if page != "?" else "NO PAGE"
            if pend and pend != page:
                page_label = f"pp.{page}–{pend}"

            print(f"\n  Result #{i}")
            print(f"    Book:    {book}")
            print(f"    Page:    {page_label}")
            print(f"    Subject: {subj}  |  Source: {src}")
            print(f"    Text:    {textwrap.fill(text[:320], width=68, subsequent_indent=' '*11)}")

            if page == "?":
                all_have_pages = False

        if all_have_pages:
            print(f"\n  PASS — all {len(results)} results have page numbers")
            passed += 1
        else:
            print(f"\n  FAIL:PARTIAL — some results missing page numbers")
            failed += 1

    hr("=")
    print(f"\n  SUMMARY: {passed} passed, {failed} failed out of {len(QUERIES)} queries")
    hr("=")

def main():
    print()
    hr("=")
    print("  Brainwave RAG — Seed & Page-Number Verification Test")
    hr("=")
    print()

    cs = setup()
    ingest_books(cs)
    run_queries(cs)

if __name__ == "__main__":
    main()
