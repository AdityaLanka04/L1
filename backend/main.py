import os
import sys
import logging
import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("SECRET_KEY"):
    raise RuntimeError("SECRET_KEY environment variable is not set")

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
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub.file_download").setLevel(logging.WARNING)
logging.getLogger("neo4j").setLevel(logging.ERROR)
logging.getLogger("neo4j.notifications").setLevel(logging.ERROR)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
if os.getenv("ENVIRONMENT", "development") == "production" and "sqlite" in DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be set to PostgreSQL in production. SQLite is not supported for production use.")

models.Base.metadata.create_all(bind=engine)

if "sqlite" in DATABASE_URL:
    _SR_COLUMNS = {
        "ease_factor": "FLOAT DEFAULT 2.5",
        "interval": "FLOAT DEFAULT 0",
        "repetitions": "INTEGER DEFAULT 0",
        "next_review_date": "DATETIME",
        "lapses": "INTEGER DEFAULT 0",
        "sr_state": "VARCHAR(20) DEFAULT 'new'",
        "learning_step": "INTEGER DEFAULT 0",
        "fsrs_stability": "FLOAT DEFAULT 0.0",
    }
    with engine.connect() as _conn:
        _existing = {r[1] for r in _conn.execute(text("PRAGMA table_info(flashcards)"))}
        for _col, _typ in _SR_COLUMNS.items():
            if _col not in _existing:
                _conn.execute(text(f"ALTER TABLE flashcards ADD COLUMN {_col} {_typ}"))
                logger.info("Added column flashcards.%s", _col)
        _conn.commit()

    with engine.connect() as _conn:
        _profile_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(comprehensive_user_profiles)"))}
        if "notifications_enabled" not in _profile_cols:
            _conn.execute(text("ALTER TABLE comprehensive_user_profiles ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1"))
            logger.info("Added column comprehensive_user_profiles.notifications_enabled")
        _conn.commit()

    with engine.connect() as _conn:
        _gamification_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(user_gamification_stats)"))}
        _gamification_additions = {
            "weekly_chat_goal": "INTEGER DEFAULT 10",
            "weekly_note_goal": "INTEGER DEFAULT 5",
            "weekly_flashcard_goal": "INTEGER DEFAULT 20",
            "weekly_quiz_goal": "INTEGER DEFAULT 5",
        }
        for _col, _typ in _gamification_additions.items():
            if _col not in _gamification_cols:
                _conn.execute(text(f"ALTER TABLE user_gamification_stats ADD COLUMN {_col} {_typ}"))
                logger.info("Added column user_gamification_stats.%s", _col)
        _conn.commit()

    with engine.connect() as _conn:
        _ctx_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(context_documents)"))}
        _ctx_additions = {
            "source_name": "VARCHAR(200)",
            "license": "VARCHAR(80)",
            "curriculum": "VARCHAR(20)",
            "source_type": "VARCHAR(40)",
            "ai_summary": "TEXT",
            "key_concepts": "TEXT",
            "topic_tags": "TEXT",
        }
        for _col, _typ in _ctx_additions.items():
            if _col not in _ctx_cols:
                _conn.execute(text(f"ALTER TABLE context_documents ADD COLUMN {_col} {_typ}"))
                logger.info("Added column context_documents.%s", _col)
        _conn.commit()

    with engine.connect() as _conn:
        _has_podcast_table = _conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='podcast_sessions'")
        ).fetchone()
        if _has_podcast_table:
            _podcast_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(podcast_sessions)"))}
            _podcast_additions = {
                "voice_persona": "VARCHAR(50) DEFAULT 'mentor'",
                "difficulty": "VARCHAR(20) DEFAULT 'intermediate'",
                "answer_language": "VARCHAR(20) DEFAULT 'en'",
                "session_options": "TEXT DEFAULT '{}'",
            }
            for _col, _typ in _podcast_additions.items():
                if _col not in _podcast_cols:
                    _conn.execute(text(f"ALTER TABLE podcast_sessions ADD COLUMN {_col} {_typ}"))
                    logger.info("Added column podcast_sessions.%s", _col)
            _conn.commit()

    with engine.connect() as _conn:
        _has_style_table = _conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='student_style_models'")
        ).fetchone()
        if _has_style_table:
            _style_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(student_style_models)"))}
            if "student_classifier_state" not in _style_cols:
                _conn.execute(text("ALTER TABLE student_style_models ADD COLUMN student_classifier_state TEXT"))
                logger.info("Added column student_style_models.student_classifier_state")
            _conn.commit()

    with engine.connect() as _conn:
        _chat_msg_cols = {r[1] for r in _conn.execute(text("PRAGMA table_info(chat_messages)"))}
        if "image_metadata" not in _chat_msg_cols:
            _conn.execute(text("ALTER TABLE chat_messages ADD COLUMN image_metadata TEXT"))
            logger.info("Added column chat_messages.image_metadata")
        _conn.commit()

    with engine.connect() as _conn:
        for _new_table in ("student_knowledge_states", "student_memories", "message_ml_logs",
                           "cerbyl_session_states", "agent_events",
                           "bandit_state", "bandit_reward_queue", "bandit_episode_log"):
            _exists = _conn.execute(
                text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{_new_table}'")
            ).fetchone()
            if not _exists:
                logger.info(f"Table {_new_table} will be created by SQLAlchemy metadata")
        _conn.commit()


def _sync_sequences():
    if "postgres" not in DATABASE_URL.lower():
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


@asynccontextmanager
async def lifespan(app: FastAPI):
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
        from deps import unified_ai, hs_context_ai as _hs_ai
        from tutor.graph import create_tutor
        create_tutor(unified_ai, SessionLocal, hs_ai_client=_hs_ai)
        logger.info("Tutor graph initialized")
    except Exception as e:
        logger.warning(f"Tutor init failed: {e}")

    try:
        from deps import unified_ai as _ai, hs_context_ai as _hs_ai
        from flashcard_graph import create_flashcard_graph
        create_flashcard_graph(_ai, SessionLocal, hs_ai_client=_hs_ai)
        logger.info("Flashcard graph initialized")
    except Exception as e:
        logger.warning(f"Flashcard graph init failed: {e}")

    try:
        from deps import unified_ai as _ai
        from learningpath_graph import create_learningpath_graph
        create_learningpath_graph(_ai, SessionLocal)
        logger.info("LearningPath graph initialized")
    except Exception as e:
        logger.warning(f"LearningPath graph init failed: {e}")

    try:
        from deps import unified_ai as _ai
        from searchhub_graph import create_searchhub_graph
        create_searchhub_graph(_ai, SessionLocal)
        logger.info("SearchHub graph initialized")
    except Exception as e:
        logger.warning(f"SearchHub graph init failed: {e}")

    try:
        from deps import unified_ai as _ai, hs_context_ai as _hs_ai
        from quiz_graph import create_quiz_graph
        create_quiz_graph(_ai, SessionLocal, hs_ai_client=_hs_ai)
        logger.info("Quiz graph initialized")
    except Exception as e:
        logger.warning(f"Quiz graph init failed: {e}")

    try:
        from deps import unified_ai as _ai, hs_context_ai as _hs_ai
        from note_graph import create_note_graph
        create_note_graph(_ai, SessionLocal, hs_ai_client=_hs_ai)
        logger.info("Note graph initialized")
    except Exception as e:
        logger.warning(f"Note graph init failed: {e}")

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
        from sentence_transformers import SentenceTransformer
        try:
            _embed_model_inst = SentenceTransformer("BAAI/bge-small-en-v1.5")
            logger.info("Embedding model loaded: BAAI/bge-small-en-v1.5")
        except Exception:
            _embed_model_inst = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Embedding model loaded: all-MiniLM-L6-v2 (fallback)")

        import vector_store
        vector_store.initialize(_embed_model_inst)
        logger.info("vector_store (pgvector) initialized")

        try:
            import context_store
            subjects = context_store.list_hs_subjects()
            if subjects:
                logger.info(
                    f"HS curriculum: {len(subjects)} subject(s) seeded: "
                    + ", ".join(f"{s['subject']} ({s['doc_count']} docs)" for s in subjects)
                )
            else:
                logger.info("HS curriculum collection is empty")
        except Exception as se:
            logger.warning(f"HS curriculum listing failed: {se}")
    except Exception as e:
        logger.warning(f"vector_store init failed: {e}")

    try:
        import redis_cache
        connected = redis_cache.init_redis()
        if connected:
            logger.info("Redis cache connected")
        else:
            logger.info("Redis unavailable — using in-memory cache fallback")
    except Exception as e:
        logger.warning(f"Redis cache init failed: {e}")

    try:
        from services.ml_pipeline import ModelRegistry
        import vector_store as _vs
        reg = ModelRegistry.get()
        if _vs.available() and _vs._embed_model and not reg._embed_model:
            reg._embed_model = _vs._embed_model
            reg._ready = True
            logger.info("ML ModelRegistry reused vector_store embedding model")
        else:
            reg.load()
            logger.info("ML ModelRegistry initialized (sentence-transformers)")
    except Exception as e:
        logger.warning(f"ModelRegistry init failed: {e}")

    try:
        import vector_store as _vs
        from services.memory_service import initialize_memory_service

        if _vs.available():
            def _embed_fn(text):
                try:
                    return _vs._embed_model.encode(text, normalize_embeddings=True)
                except Exception:
                    return [0.0] * 384
            initialize_memory_service(_embed_fn)
        else:
            logger.warning("MemoryService skipped — vector_store unavailable")
    except Exception as e:
        logger.warning(f"MemoryService init failed: {e}")

    try:
        from database import SessionLocal as _sl
        from services.memory_service import get_memory_service
        from services.context_agent import initialize_context_agent

        initialize_context_agent(_sl, get_memory_service())
    except Exception as e:
        logger.warning(f"ContextAgent init failed: {e}")

    _scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from services.rl_strategy_agent import get_bandit

        _bandit_instance = get_bandit()
        _scheduler = AsyncIOScheduler()

        def _run_reward_measurement():
            _bandit_instance.measure_pending_rewards(SessionLocal)

        _scheduler.add_job(
            _run_reward_measurement,
            "interval",
            seconds=60,
            id="rl_reward_measurement",
            max_instances=1,
            coalesce=True,
        )
        _scheduler.start()
        logger.info("RL reward measurement scheduler started (60s interval)")
    except ImportError:
        logger.warning("APScheduler not installed — RL reward measurement disabled. Add apscheduler>=3.10.0 to requirements.txt")
    except Exception as e:
        logger.warning(f"RL scheduler init failed: {e}")

    logger.info("Startup complete")
    yield

    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass


app = FastAPI(title="Brainwave Backend API", version="4.0.0", lifespan=lifespan)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://cerbyl.com,https://www.cerbyl.com"
).split(",")
_is_dev = os.getenv("ENVIRONMENT", "development") != "production"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _is_dev else allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app$" if not _is_dev else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-User-Id", "X-Requested-With"],
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
    learningpath,
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
    searchhub,
    reviews,
    weakness,
    imports,
    context as context_routes,
    knowledge_tracing,
    intelligence,
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(notes.router)
app.include_router(flashcards.router)
app.include_router(learningpath.router)
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
app.include_router(searchhub.router)
app.include_router(reviews.router)
app.include_router(weakness.router)
app.include_router(imports.router)
app.include_router(context_routes.router)
app.include_router(knowledge_tracing.router)
app.include_router(intelligence.router)

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
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level="info",
    )
