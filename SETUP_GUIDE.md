# Setup Guide for New Developers

## First Time Setup (Your Friend Should Do This)

### Step 1: Install Prerequisites

1. **Python 3.9+**
   - Download from https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"

2. **Node.js 16+**
   - Download from https://nodejs.org/
   - Install LTS version

3. **Git**
   - Download from https://git-scm.com/

### Step 2: Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd BrainwaveAI

# Install frontend dependencies
npm install
```

### Step 3: Backend Setup

```bash
# Go to backend folder
cd backend

# Create virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

### Step 4: Configure Environment

1. Copy `backend/.env.example` to `backend/.env`
2. Edit `backend/.env` and add your API keys:

```env
SECRET_KEY=any-random-string-here
GOOGLE_GENERATIVE_AI_KEY=get-from-google-ai-studio
```

**Get Gemini API Key:**
- Go to https://makersuite.google.com/app/apikey
- Create a new API key
- Copy and paste into `.env`

### Step 5: Run the Application

**Option A: Using Batch Files (Windows)**

1. Double-click `start_backend.bat`
2. Double-click `start_frontend.bat`

**Option B: Manual Start**

Terminal 1 (Backend):
```bash
cd backend
.venv\Scripts\activate
python main.py
```

Terminal 2 (Frontend):
```bash
npm start
```

### Step 6: Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Daily Development Workflow

### Starting Work

1. Pull latest changes:
   ```bash
   git pull
   ```

2. Start backend:
   ```bash
   cd backend
   .venv\Scripts\activate
   python main.py
   ```

3. Start frontend (new terminal):
   ```bash
   npm start
   ```

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes

4. Commit and push:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin feature/your-feature-name
   ```

## Important Files

### Backend
- `backend/main.py` - Main FastAPI application (START HERE)
- `backend/models.py` - Database models
- `backend/agents/` - AI agents for different features
- `backend/.env` - Environment variables (DO NOT COMMIT)

### Frontend
- `src/App.js` - Main React component
- `src/pages/` - All page components
- `src/services/` - API service calls
- `src/config/api.js` - API configuration

## Common Commands

### Backend

```bash
# Activate virtual environment
cd backend
.venv\Scripts\activate

# Install new package
pip install package-name
pip freeze > requirements.txt

# Run backend
python main.py

# Database migration
python migration.py
```

### Frontend

```bash
# Install new package
npm install package-name

# Start dev server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Troubleshooting

### "Module not found" error
```bash
# Backend
cd backend
.venv\Scripts\activate
pip install -r requirements.txt

# Frontend
npm install
```

### Backend won't start
1. Check if virtual environment is activated (you should see `(.venv)` in terminal)
2. Check if `.env` file exists with API keys
3. Check if port 8000 is already in use

### Frontend won't start
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Check if port 3000 is already in use

### Database errors
```bash
cd backend
python migration.py
```

## Optional Services

### Redis (for caching)
1. Install Redis from https://redis.io/download
2. Add to `.env`: `REDIS_URL=redis://localhost:6379`

### Neo4j (for knowledge graph)
1. Install Neo4j Desktop from https://neo4j.com/download/
2. Create a database
3. Add credentials to `.env`:
   ```env
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   ```

## Need Help?

- Check the main README.md
- Look at API docs: http://localhost:8000/docs
- Check terminal logs for error messages
- Ask the team!

## Quick Reference

**Is main.py enough?**
Yes! `main.py` is the main entry point. It imports everything else automatically.

**What to run:**
1. Backend: `python main.py` (in backend folder with venv activated)
2. Frontend: `npm start` (in root folder)

**What to configure:**
- `backend/.env` - Add your API keys here
- That's it! Everything else works out of the box.
