# Quick Start Checklist

## For Your Friend to Get Started

### ✅ Prerequisites
- [ ] Python 3.9+ installed
- [ ] Node.js 16+ installed
- [ ] Git installed

### ✅ Setup (One Time)

```bash
# 1. Clone repo
git clone <repo-url>
cd BrainwaveAI

# 2. Install frontend
npm install

# 3. Setup backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 4. Configure environment
# Copy backend/.env.example to backend/.env
# Add your GOOGLE_GENERATIVE_AI_KEY
```

### ✅ Run Application

**Easy Way (Windows):**
1. Double-click `start_backend.bat`
2. Double-click `start_frontend.bat`

**Manual Way:**

Terminal 1:
```bash
cd backend
.venv\Scripts\activate
python main.py
```

Terminal 2:
```bash
npm start
```

### ✅ Access

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## That's It!

**Yes, main.py is enough!** It automatically:
- Loads all modules
- Connects to database
- Starts all AI agents
- Enables progress tracking
- Serves API endpoints

Just run `python main.py` and everything works!

## What Your Friend Needs

1. **Required:**
   - Python 3.9+
   - Node.js 16+
   - Gemini API key (free from https://makersuite.google.com/app/apikey)

2. **Optional:**
   - Redis (for caching)
   - Neo4j (for knowledge graph)

3. **Files to Configure:**
   - `backend/.env` - Add API keys here

That's literally it! Everything else is pre-configured.
