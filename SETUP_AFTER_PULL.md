# Setup Guide After Pulling Latest Changes

## Overview
This guide helps you set up the project after pulling the latest changes, including statistics fixes and point system updates.

---

## 🚀 Quick Setup (For Fresh Pull)

### 1. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# OR
source .venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
```

---

## 🔧 Database Setup

### For SQLite (Localhost Development)

**Run the comprehensive stats fix:**
```bash
cd backend
python fix_stats_sqlite.py
```

This script will:
- ✅ Count all flashcard sets, notes, AI chats from database tables
- ✅ Recalculate total points and weekly points
- ✅ Update gamification stats (level, experience, etc.)
- ✅ Fix any inconsistencies in statistics

**Optional - Backfill historical point transactions:**
```bash
python backfill_point_transactions.py
```
Type `yes` when prompted.

This script will:
- ✅ Create PointTransaction records for existing flashcards, notes, and chats
- ✅ Populate Analytics charts with historical data
- ✅ Enable "Recent Activity" section in Games page

---

### For PostgreSQL (Production)

**Run the comprehensive stats fix:**
```bash
cd backend
python comprehensive_stats_fix.py
```

**Optional - Backfill historical point transactions:**
```bash
python backfill_point_transactions.py
```
Type `yes` when prompted.

---

## 🎮 Start the Application

### Backend:
```bash
cd backend
.venv\Scripts\activate  # Windows
# OR
source .venv/bin/activate  # Mac/Linux

uvicorn main:app --reload --port 8000
```

### Frontend:
```bash
npm start
```

The app will open at `http://localhost:3000`

---

## ✅ Verify Everything Works

After setup, check these pages:

1. **Dashboard** - Should show correct flashcard counts and stats
2. **Analytics** - Should display charts with historical data
3. **Games** - Should show correct total points, weekly points, and level
4. **Flashcards** - Create a new flashcard set and verify points are awarded

---

## 🐛 Troubleshooting

### Stats still showing incorrect numbers?
1. Hard refresh the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Re-run the stats fix script

### Backend not starting?
1. Make sure virtual environment is activated
2. Check if all dependencies are installed: `pip install -r requirements.txt`
3. Verify `.env` file exists in backend folder with correct API keys

### Frontend not loading?
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear browser cache

---

## 📊 What Changed?

### Statistics System
- ✅ Flashcard sets now properly counted (not individual cards)
- ✅ AI chats separated from flashcards
- ✅ Points automatically calculated from activities
- ✅ Weekly and all-time stats tracked separately

### Point System
- ✅ Creating flashcard sets now awards 10 points
- ✅ Creating notes awards 20 points
- ✅ AI chat messages award 1 point each
- ✅ All activities tracked in PointTransaction table

### Pages Updated
- ✅ Dashboard - Uses gamification stats
- ✅ Analytics - Shows historical data from point transactions
- ✅ Games - Displays correct points, level, and recent activity
- ✅ Flashcards - Awards points on creation

---

## 🔑 Environment Variables

Make sure your `backend/.env` file has:
```env
# Required
GOOGLE_GENERATIVE_AI_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=your_secret_key

# Optional (for PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database
USE_POSTGRES=true
```

---

## 📝 Notes

- The stats fix scripts are **safe to run multiple times** - they won't duplicate data
- Backfill script checks for existing transactions before creating new ones
- All future activities will automatically create point transactions
- Stats auto-update when you create/delete items

---

## 🆘 Need Help?

If you encounter any issues:
1. Check the console for error messages
2. Verify all dependencies are installed
3. Make sure API keys are set in `.env`
4. Try running the stats fix script again

---

**Happy coding! 🚀**
