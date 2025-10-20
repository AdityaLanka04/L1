from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        # Add completeness_percentage
        try:
            conn.execute(text("ALTER TABLE learning_review_attempts ADD COLUMN completeness_percentage FLOAT DEFAULT 0.0"))
            print("✅ Added completeness_percentage")
        except:
            print("⏭️  completeness_percentage exists")
        
        # Add feedback
        try:
            conn.execute(text("ALTER TABLE learning_review_attempts ADD COLUMN feedback TEXT"))
            print("✅ Added feedback")
        except:
            print("⏭️  feedback exists")
        
        # Add submitted_at
        try:
            conn.execute(text("ALTER TABLE learning_review_attempts ADD COLUMN submitted_at DATETIME"))
            print("✅ Added submitted_at")
        except:
            print("⏭️  submitted_at exists")
        
        # Add attempt_count
        try:
            conn.execute(text("ALTER TABLE learning_reviews ADD COLUMN attempt_count INTEGER DEFAULT 0"))
            print("✅ Added attempt_count")
        except:
            print("⏭️  attempt_count exists")
        
        conn.commit()
        print("\n✅ All columns added successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")