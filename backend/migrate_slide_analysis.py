"""
Migration script to add slide_analyses table
Run this to add the new table for storing comprehensive slide analyses
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from database import Base, engine
from models import SlideAnalysis, UploadedSlide
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """Create slide_analyses table"""
    try:
        logger.info("Creating slide_analyses table...")
        
        # Create all tables (will only create missing ones)
        Base.metadata.create_all(bind=engine)
        
        logger.info("✅ Migration completed successfully!")
        logger.info("slide_analyses table is ready to store comprehensive slide analyses")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    migrate()
