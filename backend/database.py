from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, NullPool
import os
import logging

logger = logging.getLogger(__name__)

# Detect Render's PostgreSQL or fallback to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

# ✅ CRITICAL FIX: Switch to Transaction mode for Supabase (port 6543)
if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
    if ":5432/" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace(":5432/", ":6543/")
        logger.info("✅ Switched to Transaction mode pooling (port 6543)")

# Conditional configuration based on database type
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration (local development)
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        echo=False
    )
    logger.info("🗄️ Using SQLite database (local development)")
    
else:
    # PostgreSQL configuration (production with Supabase/Render)
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,           # ✅ Use connection pooling
        pool_size=10,                  # ✅ 10 permanent connections
        max_overflow=20,               # ✅ +20 temporary connections (total: 30)
        pool_timeout=30,               # ✅ Wait 30s for available connection
        pool_recycle=1800,             # ✅ Recycle connections every 30 mins
        pool_pre_ping=True,            # ✅ Test connections before use
        connect_args={
            "connect_timeout": 10,
            "application_name": "brainwave_api",
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5
        },
        echo=False  # Set to True for debugging SQL queries
    )
    logger.info("🐘 Using PostgreSQL with optimized connection pooling")
    
    # Optional: Log connection events for monitoring
    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_conn, connection_record):
        logger.debug("🔌 New DB connection opened")
    
    @event.listens_for(engine, "close")
    def receive_close(dbapi_conn, connection_record):
        logger.debug("🔌 DB connection closed")

# Session and Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    """Database session dependency with proper cleanup"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()  # ✅ Always close connection