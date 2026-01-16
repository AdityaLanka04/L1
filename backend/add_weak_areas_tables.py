"""
Migration script to add weak areas tracking tables.
Run this once to create the new tables.
"""

import os
import sys
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def migrate():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
    
    with engine.connect() as conn:
        # Create user_weak_areas table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_weak_areas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic VARCHAR(255) NOT NULL,
                subtopic VARCHAR(255),
                total_questions INTEGER DEFAULT 0,
                correct_count INTEGER DEFAULT 0,
                incorrect_count INTEGER DEFAULT 0,
                accuracy FLOAT DEFAULT 0.0,
                weakness_score FLOAT DEFAULT 0.0,
                consecutive_wrong INTEGER DEFAULT 0,
                last_wrong_streak INTEGER DEFAULT 0,
                practice_sessions INTEGER DEFAULT 0,
                last_practiced DATETIME,
                improvement_rate FLOAT DEFAULT 0.0,
                status VARCHAR(50) DEFAULT 'needs_practice',
                priority INTEGER DEFAULT 5,
                first_identified DATETIME,
                last_updated DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """))
        
        # Create index on user_id and topic
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_weak_areas_user_topic ON user_weak_areas(user_id, topic)"))
        except:
            pass
        
        # Create wrong_answer_logs table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS wrong_answer_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                question_set_id INTEGER NOT NULL,
                attempt_id INTEGER,
                question_text TEXT NOT NULL,
                topic VARCHAR(255),
                difficulty VARCHAR(20),
                correct_answer TEXT NOT NULL,
                user_answer TEXT NOT NULL,
                mistake_type VARCHAR(100),
                confidence_before INTEGER,
                reviewed BOOLEAN DEFAULT 0,
                reviewed_at DATETIME,
                understood_after_review BOOLEAN,
                answered_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id),
                FOREIGN KEY (question_set_id) REFERENCES question_sets(id),
                FOREIGN KEY (attempt_id) REFERENCES question_attempts(id)
            )
        """))
        
        # Create index on user_id and topic
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wrong_answers_user_topic ON wrong_answer_logs(user_id, topic)"))
        except:
            pass
        
        # Create practice_recommendations table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS practice_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                recommendation_type VARCHAR(50) NOT NULL,
                topic VARCHAR(255) NOT NULL,
                reason TEXT,
                priority INTEGER DEFAULT 5,
                question_set_id INTEGER,
                suggested_question_count INTEGER DEFAULT 5,
                suggested_difficulty VARCHAR(20) DEFAULT 'medium',
                status VARCHAR(50) DEFAULT 'pending',
                completed_at DATETIME,
                created_at DATETIME,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_set_id) REFERENCES question_sets(id)
            )
        """))
        
        conn.commit()
        print("✅ Weak areas tracking tables created successfully!")

if __name__ == "__main__":
    migrate()
