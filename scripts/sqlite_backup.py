#!/usr/bin/env python3
import argparse
import json
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Optional


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "backend" / "brainwave_tutor.db"
DEFAULT_BACKUP_DIR = REPO_ROOT / "backend" / "backups" / "sqlite"
IST = ZoneInfo("Asia/Kolkata")


def timestamp() -> str:
    return datetime.now(IST).strftime("%Y%m%d-%H%M%S-IST")


def quick_check(db_path: Path) -> None:
    with sqlite3.connect(str(db_path)) as conn:
        result = conn.execute("PRAGMA quick_check").fetchone()
    if not result or result[0] != "ok":
        raise RuntimeError(f"quick_check failed for {db_path}: {result}")


def backup_database(source: Path, backup_dir: Path, keep_days: int, keep_last: int) -> Path:
    source = source.resolve()
    backup_dir.mkdir(parents=True, exist_ok=True)

    if not source.exists():
        raise FileNotFoundError(f"SQLite database not found: {source}")

    quick_check(source)

    backup_path = backup_dir / f"{source.stem}-{timestamp()}.db"
    metadata_path = backup_path.with_suffix(".json")

    with sqlite3.connect(str(source)) as source_conn:
        with sqlite3.connect(str(backup_path)) as backup_conn:
            source_conn.backup(backup_conn)

    quick_check(backup_path)

    metadata = {
        "source": str(source),
        "backup": str(backup_path),
        "created_at_ist": datetime.now(IST).isoformat(timespec="seconds"),
        "quick_check": "ok",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    update_latest_link(backup_path, backup_dir)
    prune_backups(backup_dir, keep_days, keep_last)
    return backup_path


def update_latest_link(backup_path: Path, backup_dir: Path) -> None:
    latest = backup_dir / "latest.db"
    if latest.exists() or latest.is_symlink():
        latest.unlink()
    try:
        latest.symlink_to(backup_path.name)
    except OSError:
        shutil.copy2(backup_path, latest)


def backup_files(backup_dir: Path):
    return sorted(
        path
        for path in backup_dir.glob("*.db")
        if path.name != "latest.db" and path.is_file()
    )


def prune_backups(backup_dir: Path, keep_days: int, keep_last: int) -> None:
    backups = backup_files(backup_dir)
    if keep_days <= 0 and keep_last <= 0:
        return

    cutoff = datetime.now(IST) - timedelta(days=keep_days) if keep_days > 0 else None
    keep = set(backups[-keep_last:]) if keep_last > 0 else set()

    for backup in backups:
        created = datetime.fromtimestamp(backup.stat().st_mtime, IST)
        if backup in keep:
            continue
        if cutoff and created >= cutoff:
            continue
        backup.unlink(missing_ok=True)
        backup.with_suffix(".json").unlink(missing_ok=True)


def list_backups(backup_dir: Path) -> None:
    for backup in reversed(backup_files(backup_dir)):
        size_mb = backup.stat().st_size / (1024 * 1024)
        created = datetime.fromtimestamp(backup.stat().st_mtime, IST)
        print(f"{created:%Y-%m-%d %H:%M:%S %Z}  {size_mb:8.2f} MB  {backup}")


def resolve_backup(backup_arg: Optional[str], backup_dir: Path) -> Path:
    if backup_arg:
        backup = Path(backup_arg)
        if not backup.is_absolute():
            backup = (Path.cwd() / backup).resolve()
        return backup

    latest = backup_dir / "latest.db"
    if latest.exists():
        return latest.resolve()

    backups = backup_files(backup_dir)
    if not backups:
        raise FileNotFoundError(f"No backups found in {backup_dir}")
    return backups[-1]


def restore_database(source: Path, backup_dir: Path, backup_arg: Optional[str], force: bool) -> Path:
    source = source.resolve()
    backup = resolve_backup(backup_arg, backup_dir.resolve())

    if not backup.exists():
        raise FileNotFoundError(f"Backup not found: {backup}")

    quick_check(backup)

    if source.exists() and not force:
        try:
            quick_check(source)
        except Exception:
            pass
        else:
            raise RuntimeError(
                f"Refusing to replace healthy database {source}. "
                "Pass --force if you intentionally want to restore over it."
            )

    source.parent.mkdir(parents=True, exist_ok=True)
    stamp = timestamp()

    for path in [source, Path(f"{source}-wal"), Path(f"{source}-shm")]:
        if path.exists():
            path.replace(path.with_name(f"{path.name}.before-restore-{stamp}"))

    shutil.copy2(backup, source)
    quick_check(source)
    return backup


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backup and restore the local BrainwaveAI SQLite DB.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)

    subparsers = parser.add_subparsers(dest="command", required=True)

    backup = subparsers.add_parser("backup", help="Create an online SQLite backup.")
    backup.add_argument("--keep-days", type=int, default=14)
    backup.add_argument("--keep-last", type=int, default=14)

    subparsers.add_parser("list", help="List available backups.")

    restore = subparsers.add_parser("restore", help="Restore from a backup. Stop the app first.")
    restore.add_argument("backup", nargs="?", help="Backup path. Defaults to latest.db.")
    restore.add_argument("--force", action="store_true", help="Allow replacing a healthy database.")

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.command == "backup":
        backup_path = backup_database(args.source, args.backup_dir, args.keep_days, args.keep_last)
        print(f"Created SQLite backup: {backup_path}")
    elif args.command == "list":
        list_backups(args.backup_dir)
    elif args.command == "restore":
        backup_path = restore_database(args.source, args.backup_dir, args.backup, args.force)
        print(f"Restored {args.source.resolve()} from {backup_path}")


if __name__ == "__main__":
    main()
