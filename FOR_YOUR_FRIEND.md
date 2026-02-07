# BrainwaveAI - Setup Instructions

Hey! Here's everything you need to get this project running on your machine.

## What You Need (5 minutes)

1. **Python 3.9+** - https://www.python.org/downloads/
2. **Node.js 16+** - https://nodejs.org/
3. **Gemini API Key** (free) - https://makersuite.google.com/app/apikey

## Setup Steps (10 minutes)

### 1. Clone the Project
```bash
git clone <repository-url>
cd BrainwaveAI
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Setup Backend
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# Install packages
pip install -r requirements.txt
```

### 4. Configure API Key
1. Copy `backend/.env.example` to `backend/.env`
2. Open `backend/.env` in any text editor
3. Add your Gemini API key:
   ```
   GOOGLE_GENERATIVE_AI_KEY=your-key-here
   ```

## Running the App (2 commands)

### Easy Way (Windows)
Just double-click these files:
1. `start_backend.bat`
2. `start_frontend.bat`

### Manual Way
**Terminal 1 (Backend):**
```bash
cd backend
.venv\Scripts\activate
python main.py
```

**Terminal 2 (Frontend):**
```bash
npm start
```

## Access the App
- Open browser: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## That's It!

The app will:
- ✅ Create database automatically
- ✅ Load all AI agents
- ✅ Enable progress tracking
- ✅ Start all features

## Is main.py Enough?

**YES!** `main.py` is the only file you need to run. It automatically:
- Imports all modules
- Connects to database (SQLite by default)
- Initializes all AI agents
- Starts the API server
- Enables all features

You don't need to run anything else!

## What Each Part Does

### Backend (`python main.py`)
- FastAPI server on port 8000
- AI chat, learning paths, flashcards, quizzes
- Progress tracking
- Database (SQLite file)

### Frontend (`npm start`)
- React app on port 3000
- User interface
- Connects to backend API

## Common Issues

### "Module not found"
```bash
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
```

### "Port already in use"
- Close other apps using port 8000 or 3000
- Or change ports in config files

### Backend won't start
1. Make sure virtual environment is activated (you'll see `(.venv)` in terminal)
2. Check `.env` file exists with API key
3. Try: `python --version` (should be 3.9+)

## Optional Features

Everything works out of the box! But you can add:

### Redis (for faster caching)
1. Install Redis
2. Add to `.env`: `REDIS_URL=redis://localhost:6379`

### Neo4j (for knowledge graph visualization)
1. Install Neo4j Desktop
2. Add credentials to `.env`

## File Structure

```
BrainwaveAI/
├── backend/
│   ├── main.py          ← RUN THIS (backend)
│   ├── .env             ← ADD YOUR API KEY HERE
│   ├── requirements.txt
│   └── ...
├── src/                 ← React frontend code
├── package.json
└── start_backend.bat    ← OR DOUBLE-CLICK THIS
```

## Need Help?

1. Check `README.md` for detailed docs
2. Check `SETUP_GUIDE.md` for troubleshooting
3. Look at terminal logs for errors
4. API docs: http://localhost:8000/docs

## Quick Commands Reference

```bash
# Start backend
cd backend
.venv\Scripts\activate
python main.py

# Start frontend (new terminal)
npm start

# Install new Python package
pip install package-name
pip freeze > requirements.txt

# Install new npm package
npm install package-name

# Update database
cd backend
python migration.py
```

## Summary

**To run the app:**
1. Backend: `python main.py` (in backend folder with venv)
2. Frontend: `npm start` (in root folder)

**To configure:**
- Just add your Gemini API key to `backend/.env`

**That's literally it!** Everything else is pre-configured and works automatically.

Enjoy! 🚀
