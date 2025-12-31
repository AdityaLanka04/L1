# Brainwave Backend

Clean, structured FastAPI backend for the Brainwave learning platform.

## Structure

See `STRUCTURE.md` for detailed file organization.

## Key Features

- FastAPI REST API
- PostgreSQL/SQLite database support
- AI-powered chat and learning
- Adaptive learning engine
- Gamification system
- Media processing (PDF, audio, slides)
- WebSocket support for real-time features

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run the server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL or SQLite connection string
- `SECRET_KEY` - JWT secret key
- `GEMINI_API_KEY` - Google Gemini API key (primary)
- `GROQ_API_KEY` - Groq API key (fallback)

Optional:
- `GOOGLE_CLIENT_ID` - For Google OAuth
- `STORAGE_TYPE` - local/supabase/r2
- `R2_*` - Cloudflare R2 configuration
- `SUPABASE_*` - Supabase configuration

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database

The app automatically creates tables and runs migrations on startup.

For manual migration:
```bash
python database.py
```

## Logging

Logging is minimal and structured:
- INFO: Essential operations
- WARNING: Non-critical issues
- ERROR: Critical failures

No debug logs in production.
