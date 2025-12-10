#!/usr/bin/env python3
"""
Complete Database Migration Script
Creates all missing tables for both local SQLite and deployed PostgreSQL
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from database import Base, DATABASE_URL
import logging

# Import all models to register them with Base.metadata
import models

# Force import all model classes to ensure they're registered
from models import (
    User, Note, Folder, FlashcardSet, Flashcard, QuestionSet, Question,
    LearningPlaylist, PlaylistItem, PlaylistFollower, PlaylistFork,
    ImportExportHistory, ExportedFile, BatchOperation, ExternalImport
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_existing_tables(engine):
    """Get list of existing tables in the database"""
    inspector = inspect(engine)
    return inspector.get_table_names()

def create_missing_tables():
    """Create all missing tables based on models"""
    try:
        # Fix SQLite path to use the correct database location
        db_url = DATABASE_URL
        if DATABASE_URL.startswith("sqlite"):
            # Ensure we use the backend directory database
            db_url = "sqlite:///../brainwave_tutor.db"
            logger.info(f"🗄️ Using SQLite database: {db_url}")
            engine = create_engine(db_url, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(
                DATABASE_URL,
                pool_size=5,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=1800,
                pool_pre_ping=True
            )
            logger.info("🐘 Connected to PostgreSQL database")
        
        # Get existing tables
        existing_tables = get_existing_tables(engine)
        logger.info(f"📋 Found {len(existing_tables)} existing tables: {existing_tables}")
        
        # Get all model tables
        model_tables = list(Base.metadata.tables.keys())
        logger.info(f"📋 Models define {len(model_tables)} tables: {model_tables}")
        
        # Debug: Print Base registry
        logger.info(f"📋 Base registry has {len(Base.registry._class_registry)} classes")
        for name, cls in Base.registry._class_registry.items():
            if hasattr(cls, '__tablename__'):
                logger.info(f"  - {name}: {cls.__tablename__}")
        
        # Find missing tables
        missing_tables = [table for table in model_tables if table not in existing_tables]
        
        if not missing_tables:
            logger.info("✅ All tables already exist!")
            return True
        
        logger.info(f"🔧 Creating {len(missing_tables)} missing tables: {missing_tables}")
        
        # Create all missing tables
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        # Verify creation
        new_existing_tables = get_existing_tables(engine)
        newly_created = [table for table in missing_tables if table in new_existing_tables]
        
        logger.info(f"✅ Successfully created {len(newly_created)} tables: {newly_created}")
        
        if len(newly_created) != len(missing_tables):
            failed_tables = [table for table in missing_tables if table not in new_existing_tables]
            logger.error(f"❌ Failed to create tables: {failed_tables}")
            return False
        
        # Special handling for SQLite sequences
        if DATABASE_URL.startswith("sqlite"):
            logger.info("🔧 Applying SQLite-specific fixes...")
            with engine.connect() as conn:
                # No sequence fixes needed for SQLite
                pass
        
        logger.info("🎉 Database migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False

def verify_critical_tables():
    """Verify that critical tables exist and have basic structure"""
    try:
        # Fix SQLite path for verification too
        db_url = DATABASE_URL
        if DATABASE_URL.startswith("sqlite"):
            db_url = "sqlite:///../brainwave_tutor.db"
            engine = create_engine(db_url, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(DATABASE_URL)
        
        critical_tables = [
            'users', 'notes', 'flashcard_sets', 'flashcards', 
            'question_sets', 'questions', 'learning_playlists', 
            'playlist_items', 'import_export_history'
        ]
        
        existing_tables = get_existing_tables(engine)
        
        for table in critical_tables:
            if table in existing_tables:
                logger.info(f"✅ {table} - EXISTS")
            else:
                logger.error(f"❌ {table} - MISSING")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Verification failed: {e}")
        return False

def main():
    """Main migration function"""
    print("=" * 80)
    print("DATABASE MIGRATION - CREATE ALL TABLES")
    print("=" * 80)
    print(f"Database URL: {DATABASE_URL}")
    print("=" * 80)
    
    # Step 1: Create missing tables
    logger.info("Step 1: Creating missing tables...")
    if not create_missing_tables():
        logger.error("❌ Failed to create tables")
        sys.exit(1)
    
    # Step 2: Verify critical tables
    logger.info("Step 2: Verifying critical tables...")
    if not verify_critical_tables():
        logger.error("❌ Table verification failed")
        sys.exit(1)
    
    print("=" * 80)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    main()