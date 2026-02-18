import os
import sys
import logging
import warnings
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text

from database import SessionLocal, engine
import models

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

DATABASE_URL = os.getenv("DATABASE_URL", "")

models.Base.metadata.create_all(bind=engine)

# --- Migrate: add spaced-repetition columns to flashcards if missing ---
_SR_COLUMNS = {
    "ease_factor": "FLOAT DEFAULT 2.5",
    "interval": "FLOAT DEFAULT 0",
    "repetitions": "INTEGER DEFAULT 0",
    "next_review_date": "DATETIME",
    "lapses": "INTEGER DEFAULT 0",
    "sr_state": "VARCHAR(20) DEFAULT 'new'",
    "learning_step": "INTEGER DEFAULT 0",
}

with engine.connect() as _conn:
    _existing = {r[1] for r in _conn.execute(text("PRAGMA table_info(flashcards)"))}
    for _col, _typ in _SR_COLUMNS.items():
        if _col not in _existing:
            _conn.execute(text(f"ALTER TABLE flashcards ADD COLUMN {_col} {_typ}"))
            logger.info("Added column flashcards.%s", _col)
    _conn.commit()


def _sync_sequences():
    if not DATABASE_URL or "postgres" not in DATABASE_URL.lower():
        return
    try:
        sequences = [
            ("chat_messages_id_seq", "chat_messages"),
            ("chat_sessions_id_seq", "chat_sessions"),
            ("activities_id_seq", "activities"),
        ]
        with engine.connect() as conn:
            for seq, table in sequences:
                try:
                    exists = conn.execute(text("SELECT to_regclass(:s)"), {"s": seq}).scalar()
                    if not exists:
                        continue
                    conn.execute(
                        text(f"SELECT setval(:s, COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"),
                        {"s": seq},
                    )
                except Exception:
                    continue
            conn.commit()
    except Exception as e:
        logger.error(f"Sequence sync error: {e}")


_sync_sequences()

app = FastAPI(title="Brainwave Backend API", version="4.0.0")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://cerbyl.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://(l1-.*\.vercel\.app|.*cerbyl\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from activity_middleware import log_request_activity
    app.middleware("http")(log_request_activity)
except ImportError:
    pass

from routes import (
    auth,
    chat,
    notes,
    flashcards,
    questions,
    media,
    roadmaps,
    social,
    gamification,
    analytics,
    notifications,
    reminders,
    playlists,
    search,
    reviews,
    weakness,
    imports,
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(notes.router)
app.include_router(flashcards.router)
app.include_router(questions.router)
app.include_router(media.router)
app.include_router(roadmaps.router)
app.include_router(social.router)
app.include_router(social.ws_router)
app.include_router(gamification.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(reminders.router)
app.include_router(playlists.router)
app.include_router(search.router)
app.include_router(reviews.router)
app.include_router(weakness.router)
app.include_router(imports.router)

try:
    from flashcard_api_minimal import register_flashcard_api_minimal
    register_flashcard_api_minimal(app)
except ImportError:
    pass

try:
    from question_bank_enhanced import register_question_bank_api
    from deps import unified_ai
    from database import get_db
    register_question_bank_api(app, unified_ai, get_db)
except ImportError:
    pass

try:
    from learning_paths_api import register_learning_paths_api
    from deps import unified_ai
    register_learning_paths_api(app, unified_ai)
except ImportError:
    pass

try:
    from learning_progress_api import router as learning_progress_router
    app.include_router(learning_progress_router, prefix="/api/learning-progress", tags=["learning-progress"])
except ImportError:
    pass


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Brainwave API is running",
        "version": "4.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    }


@app.get("/api/test/hello")
async def test_hello():
    return {"message": "Hello! Routes are working!", "status": "success"}


@app.on_event("startup")
async def startup():
    logger.info("Starting Brainwave API v4.0.0")

    if "postgres" in DATABASE_URL:
        try:
            from migration import run_migration
            run_migration()
        except Exception as e:
            logger.warning(f"Migration error: {e}")

        try:
            db = SessionLocal()
            tables = [
                "users", "chat_sessions", "notes", "activities",
                "flashcard_sets", "daily_learning_metrics", "user_stats",
                "folders", "question_sets", "learning_reviews", "uploaded_slides",
            ]
            for table in tables:
                try:
                    max_id = db.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}")).scalar()
                    db.execute(text(f"SELECT setval('{table}_id_seq', :n)"), {"n": max_id + 1})
                except Exception:
                    continue
            db.commit()
            db.close()
        except Exception as e:
            logger.warning(f"Sequence fix error: {e}")

    try:
        from deps import unified_ai
        from tutor.graph import create_tutor
        create_tutor(unified_ai, SessionLocal)
        logger.info("Tutor graph initialized")
    except Exception as e:
        logger.warning(f"Tutor init failed: {e}")

    try:
        from deps import unified_ai as _ai
        from flashcard_graph import create_flashcard_graph
        create_flashcard_graph(_ai, SessionLocal)
        logger.info("Flashcard graph initialized")
    except Exception as e:
        logger.warning(f"Flashcard graph init failed: {e}")

    try:
        from tutor import neo4j_store
        await neo4j_store.connect()
        if neo4j_store.available():
            logger.info("Neo4j connected")
        else:
            logger.warning("Neo4j not available - knowledge graph features disabled")
    except Exception as e:
        logger.warning(f"Neo4j connection failed: {e}")

    try:
        from tutor import chroma_store
        chroma_dir = os.path.join(os.path.dirname(__file__), ".chroma_data")
        chroma_store.initialize(persist_dir=chroma_dir)
        logger.info("Chroma store initialized")
    except Exception as e:
        logger.warning(f"Chroma init failed: {e}")

    logger.info("Startup complete")


build_dir = Path(__file__).parent.parent / "build"

if build_dir.exists() and os.getenv("SERVE_REACT", "false").lower() == "true":
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        from fastapi import HTTPException
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = build_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(build_dir / "index.html")
else:
    @app.get("/")
    async def root():
        return {"message": "Brainwave Backend API v4.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    logger.info(f"Starting uvicorn server on {host}:{port}")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
