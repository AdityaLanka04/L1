from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Detect Render's PostgreSQL or fallback to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

# Conditional connection args
connect_args = {}
engine_args = {
    "pool_pre_ping": True,       # ✅ Keeps connection alive (important for Render)
    "pool_recycle": 1800,        # ✅ Recycle connections every 30 mins
}

# For SQLite (local dev only)
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_args = {}  # SQLite doesn’t support pooling

# Create the SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_args
)

# Session and Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
