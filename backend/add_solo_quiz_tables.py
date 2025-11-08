"""
Migration script to add solo quiz tables
Run this once to add the new tables to your database
"""

import sys
from sqlalchemy import text
from database import engine, SessionLocal

def migrate():
    """Add solo quiz tables"""
    
    print("🔧 Starting migration for solo quiz tables...")
    
    db = SessionLocal()
    
    try:
        # Create solo_quizzes table
        print("Creating solo_quizzes table...")
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS solo_quizzes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    subject VARCHAR(100) NOT NULL,
                    difficulty VARCHAR(20) DEFAULT 'intermediate',
                    status VARCHAR(20) DEFAULT 'active',
                    question_count INTEGER DEFAULT 10,
                    time_limit_seconds INTEGER DEFAULT 300,
                    score INTEGER DEFAULT 0,
                    completed BOOLEAN DEFAULT 0,
                    answers TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """))
            db.commit()
            print("✅ Created solo_quizzes table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("⏭️  solo_quizzes table already exists")
                db.rollback()
            else:
                print(f"⚠️  Error creating solo_quizzes: {e}")
                db.rollback()
        
        # Create solo_quiz_questions table
        print("Creating solo_quiz_questions table...")
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS solo_quiz_questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    quiz_id INTEGER NOT NULL,
                    question TEXT NOT NULL,
                    options TEXT NOT NULL,
                    correct_answer INTEGER NOT NULL,
                    explanation TEXT,
                    FOREIGN KEY (quiz_id) REFERENCES solo_quizzes(id)
                )
            """))
            db.commit()
            print("✅ Created solo_quiz_questions table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("⏭️  solo_quiz_questions table already exists")
                db.rollback()
            else:
                print(f"⚠️  Error creating solo_quiz_questions: {e}")
                db.rollback()
        
        print("\n✅ Migration completed!")
        print("\n📝 Solo quiz tables are ready to use!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
