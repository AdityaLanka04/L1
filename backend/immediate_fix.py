# immediate_fix.py - Run this to fix your current issues

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date

SQLALCHEMY_DATABASE_URL = "sqlite:///./brainwave.db"

def create_missing_tables_sql():
    """Create the missing tables using raw SQL"""
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    
    table_creation_sql = [
        """
        CREATE TABLE IF NOT EXISTS enhanced_user_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            monthly_goal INTEGER DEFAULT 100,
            favorite_subject VARCHAR DEFAULT 'General',
            last_active_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS daily_learning_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date DATE,
            sessions_completed INTEGER DEFAULT 0,
            time_spent_minutes REAL DEFAULT 0.0,
            questions_answered INTEGER DEFAULT 0,
            correct_answers INTEGER DEFAULT 0,
            topics_studied TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS comprehensive_user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            preferred_subjects TEXT,
            difficulty_level VARCHAR DEFAULT 'intermediate',
            study_schedule VARCHAR DEFAULT 'flexible',
            learning_pace VARCHAR DEFAULT 'moderate',
            motivation_factors TEXT,
            weak_areas TEXT,
            strong_areas TEXT,
            career_goals TEXT,
            study_goals TEXT,
            time_zone VARCHAR,
            study_environment VARCHAR DEFAULT 'quiet',
            preferred_language VARCHAR DEFAULT 'english',
            preferred_session_length VARCHAR,
            break_frequency VARCHAR,
            best_study_times TEXT,
            preferred_content_types TEXT,
            learning_challenges TEXT,
            device_preferences TEXT,
            accessibility_needs TEXT,
            internet_speed VARCHAR,
            data_usage VARCHAR,
            notification_preferences TEXT,
            contact_method VARCHAR,
            communication_frequency VARCHAR,
            data_consent TEXT,
            profile_visibility VARCHAR DEFAULT 'private',
            profile_completion_percentage INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS learning_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title VARCHAR,
            source_sessions TEXT,
            source_content TEXT,
            expected_points TEXT,
            review_type VARCHAR DEFAULT 'comprehensive',
            total_points INTEGER DEFAULT 0,
            current_attempt INTEGER DEFAULT 0,
            best_score REAL,
            status VARCHAR DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS learning_review_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER,
            attempt_number INTEGER,
            user_response TEXT,
            covered_points TEXT,
            missing_points TEXT,
            completeness_score REAL,
            ai_feedback TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(review_id) REFERENCES learning_reviews (id)
        )
        """,
        
        # Add placeholder tables for enhanced features
        """
        CREATE TABLE IF NOT EXISTS user_personality_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            profile_confidence REAL DEFAULT 0.0,
            visual_learner_score REAL DEFAULT 0.5,
            auditory_learner_score REAL DEFAULT 0.5,
            kinesthetic_learner_score REAL DEFAULT 0.5,
            reading_learner_score REAL DEFAULT 0.5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS topic_mastery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            topic_name VARCHAR,
            mastery_level REAL DEFAULT 0.0,
            times_studied INTEGER DEFAULT 0,
            last_studied DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS global_knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_pattern TEXT,
            response_template TEXT,
            topic_category VARCHAR,
            difficulty_level VARCHAR,
            success_rate REAL DEFAULT 0.0,
            usage_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS user_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            message_id INTEGER,
            rating INTEGER,
            feedback_text TEXT,
            improvement_suggestion TEXT,
            feedback_type VARCHAR,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS ai_learning_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE,
            total_interactions INTEGER DEFAULT 0,
            successful_interactions INTEGER DEFAULT 0,
            average_response_rating REAL DEFAULT 0.0,
            improvement_suggestions_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    ]
    
    with engine.connect() as connection:
        for sql in table_creation_sql:
            try:
                connection.execute(text(sql))
                table_name = sql.split("TABLE IF NOT EXISTS")[1].split("(")[0].strip()
                print(f"✓ Created/verified table: {table_name}")
            except Exception as e:
                print(f"Error creating table: {e}")
        
        connection.commit()
        print("✓ All tables created successfully")

def ensure_user_has_stats():
    """Ensure all existing users have the required stats records"""
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    
    with engine.connect() as connection:
        # Get all users
        users = connection.execute(text("SELECT id, username FROM users")).fetchall()
        
        for user in users:
            user_id = user[0]
            username = user[1]
            
            # Check if user has basic stats
            basic_stats = connection.execute(
                text("SELECT id FROM user_stats WHERE user_id = :user_id"),
                {"user_id": user_id}
            ).fetchone()
            
            if not basic_stats:
                connection.execute(
                    text("""
                        INSERT INTO user_stats 
                        (user_id, total_lessons, total_hours, day_streak, accuracy_percentage, last_activity)
                        VALUES (:user_id, 0, 0.0, 0, 0.0, :now)
                    """),
                    {"user_id": user_id, "now": datetime.utcnow()}
                )
                print(f"✓ Created UserStats for {username}")
            
            # Check if user has enhanced stats
            enhanced_stats = connection.execute(
                text("SELECT id FROM enhanced_user_stats WHERE user_id = :user_id"),
                {"user_id": user_id}
            ).fetchone()
            
            if not enhanced_stats:
                connection.execute(
                    text("""
                        INSERT INTO enhanced_user_stats 
                        (user_id, monthly_goal, favorite_subject, last_active_date)
                        VALUES (:user_id, 100, 'General', :now)
                    """),
                    {"user_id": user_id, "now": datetime.utcnow()}
                )
                print(f"✓ Created EnhancedUserStats for {username}")
        
        connection.commit()
        print("✓ All users now have required stats")

def verify_fix():
    """Verify that all required tables exist and are accessible"""
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    
    required_tables = [
        'users', 'user_stats', 'enhanced_user_stats', 'daily_learning_metrics',
        'comprehensive_user_profiles', 'learning_reviews', 'learning_review_attempts'
    ]
    
    with engine.connect() as connection:
        all_good = True
        for table in required_tables:
            try:
                result = connection.execute(text(f"SELECT COUNT(*) FROM {table}")).fetchone()
                count = result[0] if result else 0
                print(f"✓ Table '{table}': {count} records")
            except Exception as e:
                print(f"✗ Problem with table '{table}': {e}")
                all_good = False
        
        if all_good:
            print("\n✓ All tables verified successfully!")
            return True
        else:
            print("\n✗ Some tables have issues")
            return False

if __name__ == "__main__":
    print("Running immediate database fix...")
    print("=" * 40)
    
    try:
        # Step 1: Create missing tables
        print("1. Creating missing tables...")
        create_missing_tables_sql()
        
        # Step 2: Ensure all users have stats
        print("\n2. Ensuring all users have stats records...")
        ensure_user_has_stats()
        
        # Step 3: Verify everything works
        print("\n3. Verifying fix...")
        success = verify_fix()
        
        if success:
            print("\n" + "=" * 40)
            print("DATABASE FIX COMPLETED SUCCESSFULLY!")
            print("=" * 40)
            print("You can now restart your FastAPI server.")
            print("The 404 and 500 errors should be resolved.")
        else:
            print("\nSome issues remain. Check the error messages above.")
            
    except Exception as e:
        print(f"Fix failed: {e}")
        print("Please check your database file and permissions.")