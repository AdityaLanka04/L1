"""
Production seeder for shared HS curriculum context.

Usage examples:
  python seed_hs_curriculum.py
  python seed_hs_curriculum.py --recursive --owner-user-id 1
  python seed_hs_curriculum.py --skip-existing
  python seed_hs_curriculum.py --dry-run
  python seed_hs_curriculum.py --list

Supported files: .pdf, .txt, .md
Optional sidecars:
  - <name>.url       (first non-comment line used as source URL)
  - <name>.meta.json (subject/grade_level/source_url/source_name/license)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
SUPPORTED_SUFFIXES = {".pdf", ".txt", ".md"}
SEED_DOC_NAMESPACE = uuid.UUID("2f787f7a-6f9b-4c2d-8b35-b5f26c46b58a")


@dataclass
class SeedConfig:
    grade_level: str
    override_subject: str
    default_source_name: str
    default_license: str
    dry_run: bool
    replace_existing: bool
    fail_fast: bool
    skip_db: bool
    owner_user_id: int | None
    owner_email: str


def _load_chroma_and_embed():
    """
    Initialise ChromaDB + SentenceTransformer the same way main.py does,
    then initialise context_store.
    """
    import chromadb
    from sentence_transformers import SentenceTransformer

    chroma_path = str(Path(__file__).parent / ".chroma_data")
    print(f"  [chroma] loading from {chroma_path}")
    client = chromadb.PersistentClient(path=chroma_path)

    print("  [embed] loading all-MiniLM-L6-v2 ...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    import context_store
    context_store.initialize(client, model)
    print("  [context_store] ready")
    return client, model


def _infer_subject(filename: str) -> str:
    import context_store
    return context_store.infer_subject(filename, default="General")


def _read_url_sidecar(file_path: Path) -> str:
    url_file = file_path.with_suffix(".url")
    if not url_file.exists():
        return ""
    try:
        text = url_file.read_text(encoding="utf-8").strip()
    except Exception:
        return ""
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line
    return ""


def _read_meta_sidecar(file_path: Path) -> dict[str, Any]:
    meta_path = file_path.with_suffix(".meta.json")
    if not meta_path.exists():
        return {}
    try:
        raw = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"    [WARN] invalid meta sidecar {meta_path.name}: {e}")
        return {}
    if not isinstance(raw, dict):
        print(f"    [WARN] invalid meta sidecar {meta_path.name}: expected JSON object")
        return {}
    return raw


def _build_doc_id(file_path: Path, file_bytes: bytes) -> str:
    digest = hashlib.sha256(file_bytes).hexdigest()
    seed = f"{file_path.name}:{len(file_bytes)}:{digest}"
    return str(uuid.uuid5(SEED_DOC_NAMESPACE, seed))


def _resolve_seed_owner(db, owner_user_id: int | None, owner_email: str) -> int:
    import models

    if owner_user_id is not None:
        user = db.query(models.User).filter(models.User.id == owner_user_id).first()
        if not user:
            raise RuntimeError(f"User id {owner_user_id} not found")
        return int(user.id)

    if owner_email:
        user = db.query(models.User).filter(models.User.email == owner_email).first()
        if not user:
            raise RuntimeError(f"User email {owner_email} not found")
        return int(user.id)

    user = db.query(models.User).order_by(models.User.id.asc()).first()
    if not user:
        raise RuntimeError("No users found in database. Create a user or pass --skip-db.")
    print(f"  [db] no owner specified; using earliest user id={user.id} ({user.email})")
    return int(user.id)


def _upsert_context_document(
    db,
    *,
    owner_user_id: int,
    doc_id: str,
    filename: str,
    file_type: str,
    subject: str,
    grade_level: str,
    source_url: str,
    source_name: str,
    license_name: str,
    chunk_count: int,
    status: str,
):
    import models

    row = db.query(models.ContextDocument).filter(models.ContextDocument.doc_id == doc_id).first()
    if not row:
        row = models.ContextDocument(
            user_id=owner_user_id,
            doc_id=doc_id,
            filename=filename[:255],
            file_type=file_type[:10],
            scope="hs_shared",
            status=status[:20],
        )
        db.add(row)

    row.user_id = owner_user_id
    row.filename = filename[:255]
    row.file_type = file_type[:10]
    row.subject = subject[:100] if subject else ""
    row.grade_level = grade_level[:20] if grade_level else ""
    row.scope = "hs_shared"
    row.source_url = source_url[:500] if source_url else ""
    row.source_name = source_name[:200] if source_name else ""
    row.license = license_name[:80] if license_name else ""
    row.chunk_count = int(chunk_count)
    row.status = status[:20]


def seed_file(
    file_path: Path,
    cfg: SeedConfig,
    db,
    owner_user_id: int | None,
) -> dict[str, Any]:
    from document_processor import process_upload
    import context_store

    filename = file_path.name
    suffix = file_path.suffix.lower()
    sidecar = _read_meta_sidecar(file_path)

    try:
        file_bytes = file_path.read_bytes()
    except Exception as e:
        return {"filename": filename, "status": "error", "chunks": 0, "error": f"read failed: {e}"}

    if len(file_bytes) == 0:
        return {"filename": filename, "status": "error", "chunks": 0, "error": "file is empty"}
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        return {
            "filename": filename,
            "status": "error",
            "chunks": 0,
            "error": f"file too large ({len(file_bytes):,} bytes > {MAX_FILE_SIZE_BYTES:,})",
        }

    inferred_subject = cfg.override_subject or str(sidecar.get("subject") or "").strip() or _infer_subject(filename)
    clean_subject = context_store.canonicalize_subject(inferred_subject)
    clean_grade = str(sidecar.get("grade_level") or cfg.grade_level or "").strip()
    source_url = str(sidecar.get("source_url") or "").strip() or _read_url_sidecar(file_path)
    source_name = str(sidecar.get("source_name") or "").strip() or cfg.default_source_name
    license_name = str(sidecar.get("license") or "").strip() or cfg.default_license
    doc_id = _build_doc_id(file_path, file_bytes)

    print(f"\n  {'[DRY RUN] ' if cfg.dry_run else ''}Processing: {filename}")
    print(f"    subject={clean_subject or 'General'} grade={clean_grade or '-'} doc_id={doc_id}")

    try:
        if db is not None and owner_user_id is not None and not cfg.skip_db:
            _upsert_context_document(
                db,
                owner_user_id=owner_user_id,
                doc_id=doc_id,
                filename=filename,
                file_type=suffix.lstrip("."),
                subject=clean_subject,
                grade_level=clean_grade,
                source_url=source_url,
                source_name=source_name,
                license_name=license_name,
                chunk_count=0,
                status="processing",
            )
            db.commit()
    except Exception as e:
        if db is not None:
            db.rollback()
        return {"filename": filename, "status": "error", "chunks": 0, "error": f"db prep failed: {e}"}

    result = process_upload(
        file_bytes=file_bytes,
        filename=filename,
        subject=clean_subject,
        grade_level=clean_grade,
        scope="hs_shared",
        source_url=source_url,
    )

    if result.get("error") or not result.get("chunks"):
        err = result.get("error") or "no chunks produced"
        if db is not None and owner_user_id is not None and not cfg.skip_db:
            try:
                _upsert_context_document(
                    db,
                    owner_user_id=owner_user_id,
                    doc_id=doc_id,
                    filename=filename,
                    file_type=suffix.lstrip("."),
                    subject=clean_subject,
                    grade_level=clean_grade,
                    source_url=source_url,
                    source_name=source_name,
                    license_name=license_name,
                    chunk_count=0,
                    status="failed",
                )
                db.commit()
            except Exception:
                db.rollback()
        return {"filename": filename, "status": "error", "chunks": 0, "error": err}

    chunks = result["chunks"]
    print(
        f"    parser={result.get('pdf_parser') or 'text'} "
        f"chars={result.get('char_count', 0):,} chunks={len(chunks):,}"
    )

    if cfg.dry_run:
        return {"filename": filename, "status": "dry_run", "chunks": len(chunks), "error": None}

    try:
        stored = context_store.add_document_chunks(
            user_id=str(owner_user_id or "system"),
            doc_id=doc_id,
            filename=filename,
            chunks=chunks,
            subject=clean_subject,
            grade_level=clean_grade,
            scope="hs_shared",
            source_url=source_url,
            source_name=source_name,
            license=license_name,
            replace_existing=cfg.replace_existing,
            chunk_pages=result.get("chunk_pages") or None,
        )
        print(f"    [OK] stored {stored:,} chunks")

        if db is not None and owner_user_id is not None and not cfg.skip_db:
            _upsert_context_document(
                db,
                owner_user_id=owner_user_id,
                doc_id=doc_id,
                filename=filename,
                file_type=suffix.lstrip("."),
                subject=clean_subject,
                grade_level=clean_grade,
                source_url=source_url,
                source_name=source_name,
                license_name=license_name,
                chunk_count=stored,
                status="ready",
            )
            db.commit()

        return {"filename": filename, "status": "ok", "chunks": stored, "error": None}
    except Exception as e:
        if db is not None and owner_user_id is not None and not cfg.skip_db:
            try:
                _upsert_context_document(
                    db,
                    owner_user_id=owner_user_id,
                    doc_id=doc_id,
                    filename=filename,
                    file_type=suffix.lstrip("."),
                    subject=clean_subject,
                    grade_level=clean_grade,
                    source_url=source_url,
                    source_name=source_name,
                    license_name=license_name,
                    chunk_count=0,
                    status="failed",
                )
                db.commit()
            except Exception:
                db.rollback()
        return {"filename": filename, "status": "error", "chunks": 0, "error": f"index write failed: {e}"}


def cmd_list(db):
    import context_store
    import models

    subjects = context_store.list_hs_subjects()
    if not subjects:
        print("  hs_curriculum is empty (or context_store unavailable).")
    else:
        print(f"\n  {'Subject':<30} {'Grade':<12} {'Docs'}")
        print("  " + "-" * 56)
        for row in subjects:
            print(f"  {row['subject']:<30} {row['grade_level']:<12} {row['doc_count']}")

    if db is not None:
        total = db.query(models.ContextDocument).filter(models.ContextDocument.scope == "hs_shared").count()
        print(f"\n  context_documents(scope='hs_shared') rows: {total}")


def _discover_files(seeds_dir: Path, recursive: bool) -> list[Path]:
    if recursive:
        iterator = seeds_dir.rglob("*")
    else:
        iterator = seeds_dir.iterdir()
    files = [p for p in iterator if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES]
    return sorted(files)


def main():
    parser = argparse.ArgumentParser(description="Seed hs_curriculum context collection")
    parser.add_argument("--seeds-dir", default="seeds", help="Folder containing seed files")
    parser.add_argument("--recursive", action="store_true", help="Recursively scan seeds dir")
    parser.add_argument("--subject", default="", help="Override subject for all files")
    parser.add_argument("--grade", default="9-12", help="Default grade level")
    parser.add_argument("--source-name", default="Curriculum Seed Import", help="Default source_name")
    parser.add_argument("--license", default="Unspecified", help="Default license label")
    parser.add_argument("--owner-user-id", type=int, default=None, help="User ID to own hs_shared records")
    parser.add_argument("--owner-email", default="", help="Resolve owner by email")
    parser.add_argument("--skip-db", action="store_true", help="Skip SQL context_documents writes")
    parser.add_argument("--dry-run", action="store_true", help="Parse + chunk only; no writes")
    parser.add_argument("--list", action="store_true", help="List existing HS curriculum summary")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files whose deterministic doc_id already exists in DB",
    )
    parser.add_argument("--fail-fast", action="store_true", help="Stop on first file error")
    args = parser.parse_args()

    cfg = SeedConfig(
        grade_level=args.grade.strip(),
        override_subject=args.subject.strip(),
        default_source_name=args.source_name.strip() or "Curriculum Seed Import",
        default_license=args.license.strip() or "Unspecified",
        dry_run=args.dry_run,
        replace_existing=not args.skip_existing,
        fail_fast=args.fail_fast,
        skip_db=args.skip_db,
        owner_user_id=args.owner_user_id,
        owner_email=args.owner_email.strip(),
    )
    if args.skip_existing and args.skip_db:
        print("  [WARN] --skip-existing requires DB lookup; switching to replace mode for vector writes.")
        cfg.replace_existing = True

    print("\nCerbyl HS Curriculum Seeder")
    print("=" * 56)

    print("\nLoading ChromaDB + embedding model ...")
    try:
        _load_chroma_and_embed()
    except Exception as e:
        print(f"\n[ERROR] failed to initialise vector store: {e}")
        sys.exit(1)

    db = None
    owner_user_id: int | None = None
    if not cfg.skip_db:
        try:
            from database import SessionLocal
            import models  # noqa: F401
            db = SessionLocal()
            owner_user_id = _resolve_seed_owner(db, cfg.owner_user_id, cfg.owner_email)
            print(f"  [db] owner user_id={owner_user_id}")
        except Exception as e:
            if db is not None:
                db.close()
            print(f"\n[ERROR] failed to initialise DB owner: {e}")
            print("Use --skip-db for vector-only seeding.")
            sys.exit(1)

    try:
        if args.list:
            cmd_list(db)
            return

        seeds_dir = Path(args.seeds_dir)
        if not seeds_dir.is_absolute():
            seeds_dir = Path(__file__).parent / seeds_dir

        if not seeds_dir.exists():
            seeds_dir.mkdir(parents=True)
            print(f"\nCreated seeds directory: {seeds_dir}")
            print("Add .pdf/.txt/.md files and run again.")
            return

        files = _discover_files(seeds_dir, recursive=args.recursive)
        if not files:
            print(f"\nNo supported files found in {seeds_dir}")
            return

        print(f"\nFound {len(files)} file(s) in {seeds_dir}")
        results: list[dict[str, Any]] = []

        for file_path in files:
            if args.skip_existing and db is not None and not cfg.skip_db:
                try:
                    file_bytes = file_path.read_bytes()
                except Exception as e:
                    results.append({
                        "filename": file_path.name,
                        "status": "error",
                        "chunks": 0,
                        "error": f"read failed: {e}",
                    })
                    if cfg.fail_fast:
                        break
                    continue
                doc_id = _build_doc_id(file_path, file_bytes)
                import models
                exists = db.query(models.ContextDocument).filter(models.ContextDocument.doc_id == doc_id).first()
                if exists and (exists.status or "").lower() == "ready":
                    print(f"\n  Skipping existing: {file_path.name} (doc_id={doc_id})")
                    results.append({"filename": file_path.name, "status": "skipped", "chunks": 0, "error": None})
                    continue

            res = seed_file(file_path, cfg=cfg, db=db, owner_user_id=owner_user_id)
            results.append(res)
            if res["status"] == "error" and cfg.fail_fast:
                break

        ok = [r for r in results if r["status"] == "ok"]
        dry = [r for r in results if r["status"] == "dry_run"]
        skipped = [r for r in results if r["status"] == "skipped"]
        err = [r for r in results if r["status"] == "error"]

        print("\n" + "=" * 56)
        print("Summary")
        print("=" * 56)
        if cfg.dry_run:
            print(f"  Parsed:  {len(dry):,} file(s), {sum(r['chunks'] for r in dry):,} total chunks")
        else:
            print(f"  Success: {len(ok):,} file(s), {sum(r['chunks'] for r in ok):,} chunks indexed")
        if skipped:
            print(f"  Skipped: {len(skipped):,} file(s)")
        if err:
            print(f"  Failed:  {len(err):,} file(s)")
            for row in err:
                print(f"    - {row['filename']}: {row['error']}")

        if not cfg.dry_run:
            print("\nRun with --list to verify seeded subjects and DB counts.")

    finally:
        if db is not None:
            db.close()


if __name__ == "__main__":
    main()
