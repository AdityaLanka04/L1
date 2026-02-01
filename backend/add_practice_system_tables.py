"""
Migration script to add Comprehensive Weakness Practice System tables
Run: python add_practice_system_tables.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_practice_system_tables():
    """Add new tables for practice system"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        logger.info("Adding practice system tables...")
        
        # PracticeSession table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS practice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic VARCHAR NOT NULL,
                difficulty VARCHAR DEFAULT 'intermediate',
                target_question_count INTEGER DEFAULT 10,
                questions_answered INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                accuracy FLOAT DEFAULT 0.0,
                max_streak INTEGER DEFAULT 0,
                avg_response_time FLOAT DEFAULT 0.0,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status VARCHAR DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """))
        logger.info("✅ Created practice_sessions table")
        
        # PracticeAnswer table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS practice_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                user_answer TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                is_correct BOOLEAN DEFAULT 0,
                time_taken INTEGER DEFAULT 0,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES practice_sessions(id)
            )
        """))
        logger.info("✅ Created practice_answers table")
        
        # StudyPlan table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS study_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                goal VARCHAR NOT NULL,
                duration_weeks INTEGER DEFAULT 4,
                plan_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """))
        logger.info("✅ Created study_plans table")
        
        # GeneratedQuestion table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS generated_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic VARCHAR NOT NULL,
                subtopic VARCHAR,
                question_text TEXT NOT NULL,
                question_type VARCHAR NOT NULL,
                options TEXT,
                correct_answer TEXT NOT NULL,
                explanation TEXT NOT NULL,
                hints TEXT,
                difficulty VARCHAR DEFAULT 'intermediate',
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                times_used INTEGER DEFAULT 0,
                avg_accuracy FLOAT DEFAULT 0.0
            )
        """))
        logger.info("✅ Created generated_questions table")
        
        conn.commit()
        logger.info("✅ All practice system tables created successfully!")

if __name__ == "__main__":
    try:
        add_practice_system_tables()
        print("\n✅ Migration completed successfully!")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
