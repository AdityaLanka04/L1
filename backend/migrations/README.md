# Database Migrations

## Quick Start

### Migrate Local Database
```bash
cd backend
python migrations/migration.py
```

### Migrate Production Database
```bash
cd backend
python migrations/migration.py --production
```

### Migrate Both Databases
```bash
cd backend
python migrations/migration.py --both
```

## What This Does

The migration script will:
1. ✅ Create any missing tables (including all Learning Playlist tables)
2. ✅ Add any missing columns to existing tables
3. ✅ Work with both SQLite (local) and PostgreSQL (production)
4. ✅ Safe to run multiple times (idempotent)

## Learning Playlist Tables

The migration adds these tables:
- `learning_playlists` - Main playlist data
- `playlist_items` - Items in each playlist
- `playlist_followers` - Users following playlists
- `playlist_forks` - Forked playlists tracking
- `playlist_collaborators` - Playlist collaborators
- `playlist_comments` - Comments and ratings

## Rollback

To rollback the playlist tables only:
```bash
cd backend
python migrations/add_playlist_tables.py --rollback
```

## Troubleshooting

If you get permission errors on production:
- Make sure your DATABASE_URL environment variable is set
- Ensure your database user has CREATE TABLE permissions

If tables already exist:
- The script will skip them (safe to run)
- It will only add missing columns
