# Brainwave Setup Guide

## Quick Start with Docker

### 1. Clone the repo
```bash
git clone <repo-url>
cd brainwave
```

### 2. Create environment files
```bash
# Root .env
cp .env.example .env

# Backend .env
cp backend/.env.example backend/.env
```

### 3. Edit the .env files
Open `backend/.env` and add your API keys:
- **GOOGLE_GENERATIVE_AI_KEY**: Get from https://aistudio.google.com/app/apikey
- **GROQ_API_KEY**: Get from https://console.groq.com/keys (optional)
- **GOOGLE_CLIENT_ID**: Get from https://console.cloud.google.com/apis/credentials (for Google login)

### 4. Run with Docker
```bash
docker-compose up -d --build
```

### 5. Access the app
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Without Docker (Development)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
npm install
npm start
```

## Troubleshooting

**Database errors?**
```bash
docker exec brainwave-backend python pg_migration.py
```

**Check logs:**
```bash
docker-compose logs -f
```

**Restart:**
```bash
docker-compose restart
```
