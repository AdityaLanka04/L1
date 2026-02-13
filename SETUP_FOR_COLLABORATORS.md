# Setup Guide for Collaborators

## Quick Setup (2 Steps)

### Step 1: Pull Latest Changes
```bash
git pull origin main
```

### Step 2: Run Database Migration
```bash
python backend/migrate_flashcard_tables.py
```

You should see output like:
```
--- Checking flashcard_sets table ---
✓ share_code column already exists (or "Adding share_code column...")

--- Checking flashcards table ---
✓ is_edited column already exists (or "Adding is_edited column...")
✓ edited_at column already exists (or "Adding edited_at column...")

✓ All migrations completed successfully
```

### Step 3: Restart Backend (if running)
If your backend is already running, restart it:
- Stop the current backend process (Ctrl+C)
- Start it again: `python backend/main.py`

## That's It!

The flashcard system is now fully functional with:
- ✅ Preview mode with results summary
- ✅ Study mode (quiz) with accurate scoring
- ✅ Personalized feedback messages
- ✅ Database schema updated

## What Changed?

### Frontend
- Preview mode now shows results at the end
- Study mode prevents going back (accurate statistics)
- Correct answers always displayed
- Personalized encouragement messages

### Backend
- Database tables updated with missing columns
- No code changes needed

## Troubleshooting

### Migration Script Not Found
Make sure you pulled the latest changes:
```bash
git pull origin main
```

### Database Errors After Migration
Restart the backend server:
```bash
# Stop current backend (Ctrl+C)
python backend/main.py
```

### Still Getting Column Errors
Run the migration again (it's safe):
```bash
python backend/migrate_flashcard_tables.py
```

## Testing

After setup, test the flashcard system:
1. Generate or open a flashcard set
2. Try Preview mode - should show results at end
3. Try Study mode - should show accurate statistics
4. Verify no database errors in backend logs

## Questions?

Check these files:
- `QUICK_START.md` - User guide for the flashcard features
- `FLASHCARD_FIXES.md` - Technical details of what was fixed
- `DEPLOYMENT_NOTES.md` - Complete deployment information
