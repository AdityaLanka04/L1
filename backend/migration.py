# Create a new file: migrate_db.py

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, JSON, Boolean, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from database import SessionLocal, engine
import models
from datetime import datetime

def create_missing_tables():
    """Create any missing tables"""
    try:
        print("Creating all database tables...")
        models.Base.metadata.create_all(bind=engine)
        print("✓ All tables created successfully")
        
        # Check if we can access each model
        db = SessionLocal()
        try:
            # Test basic models
            user_count = db.query(models.User).count()
            print(f"✓ Users table: {user_count} records")
            
            stats_count = db.query(models.UserStats).count()
            print(f"✓ UserStats table: {stats_count} records")
            
            # Test enhanced models (create if missing)
            try:
                enhanced_count = db.query(models.EnhancedUserStats).count()
                print(f"✓ EnhancedUserStats table: {enhanced_count} records")
            except Exception as e:
                print(f"✗ EnhancedUserStats table missing: {e}")
                
            try:
                daily_count = db.query(models.DailyLearningMetrics).count()
                print(f"✓ DailyLearningMetrics table: {daily_count} records")
            except Exception as e:
                print(f"✗ DailyLearningMetrics table missing: {e}")
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"Migration failed: {e}")

def ensure_user_stats():
    """Ensure all users have stats records"""
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        for user in users:
            # Check if user has basic stats
            stats = db.query(models.UserStats).filter(models.UserStats.user_id == user.id).first()
            if not stats:
                stats = models.UserStats(user_id=user.id)
                db.add(stats)
                print(f"✓ Created UserStats for {user.username}")
            
            # Check if user has enhanced stats
            try:
                enhanced_stats = db.query(models.EnhancedUserStats).filter(models.EnhancedUserStats.user_id == user.id).first()
                if not enhanced_stats:
                    enhanced_stats = models.EnhancedUserStats(user_id=user.id)
                    db.add(enhanced_stats)
                    print(f"✓ Created EnhancedUserStats for {user.username}")
            except Exception as e:
                print(f"✗ Could not create EnhancedUserStats: {e}")
        
        db.commit()
        print("✓ User stats migration completed")
        
    except Exception as e:
        print(f"User stats migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting database migration...")
    create_missing_tables()
    ensure_user_stats()
    print("Migration completed!")