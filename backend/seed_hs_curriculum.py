"""
seed_hs_curriculum.py — Admin script to seed the shared hs_curriculum ChromaDB collection.

Usage:
  1. Place PDF/TXT/MD files in  backend/seeds/  (create the folder if needed)
  2. Run from the backend/ directory:
       python seed_hs_curriculum.py
  3. Optional flags:
       python seed_hs_curriculum.py --seeds-dir /path/to/folder
       python seed_hs_curriculum.py --subject "Biology" --grade "9-12"
       python seed_hs_curriculum.py --dry-run       # parse + chunk only, no DB write
       python seed_hs_curriculum.py --list          # list what's already in hs_curriculum

Each file gets a subject inferred from its filename unless --subject is passed.
A source_url can be provided per-file via a sidecar .url file (same name, .url extension).

Example folder layout:
  seeds/
    openstax_biology.pdf
    openstax_biology.url          ← optional, first line = source URL
    ck12_algebra2.pdf
    common_core_math.txt
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path
from typing import Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))

def _load_chroma_and_embed():
    """
    Initialise ChromaDB + SentenceTransformer the same way main.py does,
    then initialise context_store so it's ready for writes.
    Returns (chroma_client, embed_model).
    """
    import chromadb
    from sentence_transformers import SentenceTransformer

    chroma_path = str(Path(__file__).parent / ".chroma_data")
    print(f"  [chroma]  loading from {chroma_path}")
    client = chromadb.PersistentClient(path=chroma_path)

    print("  [embed]   loading all-MiniLM-L6-v2 …")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    import context_store
    context_store.initialize(client, model)
    print("  [context_store]  ready")
    return client, model

def _infer_subject(filename: str) -> str:
    """Guess subject from filename keywords using context_store helpers."""
    import context_store
    return context_store.infer_subject(filename, default="General")

def _read_url_sidecar(file_path: Path) -> str:
    """Read a .url sidecar file if present, return first non-empty line."""
    url_file = file_path.with_suffix(".url")
    if url_file.exists():
        text = url_file.read_text(encoding="utf-8").strip()
        for line in text.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                return line
    return ""

def seed_file(
    file_path: Path,
    subject: Optional[str],
    grade_level: str,
    dry_run: bool,
) -> dict:
    """
    Process a single file and write to hs_curriculum + user_docs_system.
    Returns a result dict with keys: filename, chunks, status, error.
    """
    from document_processor import process_upload
    import context_store

    filename = file_path.name
    inferred_subject = subject or _infer_subject(filename)
    inferred_subject = context_store.canonicalize_subject(inferred_subject)
    source_url = _read_url_sidecar(file_path)

    doc_id = hashlib.sha256(filename.encode()).hexdigest()[:36]

    print(f"\n  {'[DRY RUN] ' if dry_run else ''}Processing: {filename}")
    print(f"    subject={inferred_subject}  grade={grade_level}  doc_id={doc_id[:8]}…")

    try:
        file_bytes = file_path.read_bytes()
    except Exception as e:
        return {"filename": filename, "chunks": 0, "status": "error", "error": str(e)}

    result = process_upload(
        file_bytes=file_bytes,
        filename=filename,
        subject=inferred_subject,
        grade_level=grade_level,
        scope="hs_shared",
        source_url=source_url,
    )

    if result.get("error"):
        print(f"    [FAIL] extract/chunk error: {result['error']}")
        return {"filename": filename, "chunks": 0, "status": "error", "error": result["error"]}

    chunks = result.get("chunks", [])
    print(f"    extracted {result.get('char_count', 0):,} chars → {len(chunks)} chunks")

    if dry_run:
        return {"filename": filename, "chunks": len(chunks), "status": "dry_run", "error": None}

    try:
        stored = context_store.add_document_chunks(
            user_id="system",
            doc_id=doc_id,
            filename=filename,
            chunks=chunks,
            subject=inferred_subject,
            grade_level=grade_level,
            scope="hs_shared",
            source_url=source_url,
        )
        print(f"    [OK] stored {stored} chunks")
        return {"filename": filename, "chunks": stored, "status": "ok", "error": None}
    except Exception as e:
        print(f"    [FAIL] DB write error: {e}")
        return {"filename": filename, "chunks": 0, "status": "error", "error": str(e)}

def cmd_list():
    """Print what's already in the hs_curriculum collection."""
    import context_store
    subjects = context_store.list_hs_subjects()
    if not subjects:
        print("  hs_curriculum is empty (or context_store not initialized).")
        return
    print(f"\n  {'Subject':<30} {'Grade':<12} {'Docs'}")
    print("  " + "-" * 52)
    for s in subjects:
        print(f"  {s['subject']:<30} {s['grade_level']:<12} {s['doc_count']}")
    print()

def main():
    parser = argparse.ArgumentParser(description="Seed hs_curriculum ChromaDB collection")
    parser.add_argument("--seeds-dir", default="seeds", help="Folder containing seed files (default: seeds/)")
    parser.add_argument("--subject", default=None, help="Override subject for all files in this run")
    parser.add_argument("--grade", default="9-12", help="Grade level (default: 9-12)")
    parser.add_argument("--dry-run", action="store_true", help="Parse + chunk only; do not write to DB")
    parser.add_argument("--list", action="store_true", help="List existing hs_curriculum contents and exit")
    args = parser.parse_args()

    print("\nCerbyl HS Curriculum Seeder")
    print("=" * 50)

    print("\nLoading ChromaDB + embedding model …")
    try:
        _load_chroma_and_embed()
    except Exception as e:
        print(f"\n[ERROR] Failed to initialise: {e}")
        sys.exit(1)

    if args.list:
        import context_store
        context_store_available = context_store.available()
        if not context_store_available:
            print("[ERROR] context_store not available after init.")
            sys.exit(1)
        cmd_list()
        return

    seeds_dir = Path(args.seeds_dir)
    if not seeds_dir.is_absolute():
        seeds_dir = Path(__file__).parent / seeds_dir

    if not seeds_dir.exists():
        seeds_dir.mkdir(parents=True)
        print(f"\nCreated seeds directory: {seeds_dir}")
        print("Place PDF/TXT/MD files there and re-run this script.")
        return

    supported = {".pdf", ".txt", ".md"}
    files = sorted(
        p for p in seeds_dir.iterdir()
        if p.is_file() and p.suffix.lower() in supported
    )

    if not files:
        print(f"\nNo PDF/TXT/MD files found in {seeds_dir}")
        print("Add files and re-run.")
        return

    print(f"\nFound {len(files)} file(s) in {seeds_dir}")

    results = []
    for f in files:
        r = seed_file(f, subject=args.subject, grade_level=args.grade, dry_run=args.dry_run)
        results.append(r)

    ok = [r for r in results if r["status"] == "ok"]
    dry = [r for r in results if r["status"] == "dry_run"]
    err = [r for r in results if r["status"] == "error"]

    print("\n" + "=" * 50)
    print("Summary")
    print("=" * 50)
    if args.dry_run:
        print(f"  Parsed:  {len(dry)} file(s), {sum(r['chunks'] for r in dry):,} total chunks (not written)")
    else:
        print(f"  Success: {len(ok)} file(s), {sum(r['chunks'] for r in ok):,} chunks written to hs_curriculum")
    if err:
        print(f"  Failed:  {len(err)} file(s)")
        for r in err:
            print(f"    - {r['filename']}: {r['error']}")

    if ok and not args.dry_run:
        print("\nRun with --list to verify what's now in hs_curriculum.")

if __name__ == "__main__":
    main()
