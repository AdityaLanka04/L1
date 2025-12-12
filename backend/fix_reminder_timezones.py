#!/usr/bin/env python3
"""
Script to fix existing reminder timezones.
This converts reminders that were stored as UTC back to local time.

Run this once after deploying the timezone fix.
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Reminder
from database import DATABASE_URL

def fix_reminder_timezones():
    """
    Fix existing reminders that were stored as UTC.
    
    This assumes most users are in common timezones and converts
    UTC times back to reasonable local times.
    """
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get all reminders with dates
        reminders = db.query(Reminder).filter(
            Reminder.reminder_date != None
        ).all()
        
        print(f"Found {len(reminders)} reminders to check")
        
        fixed_count = 0
        
        for reminder in reminders:
            if not reminder.reminder_date:
                continue
                
            # Check if this looks like a UTC time that should be local
            # If the hour is very early (0-6 AM), it might be a UTC time
            # that should be converted to a more reasonable local time
            
            original_time = reminder.reminder_date
            hour = original_time.hour
            
            # If it's between midnight and 6 AM, it might be a UTC time
            # that was meant to be a reasonable local time
            if 0 <= hour <= 6:
                # Assume user is in a timezone like EST/PST (UTC-5 to UTC-8)
                # Convert by adding 5-8 hours to make it a reasonable time
                
                # For 3:05 AM -> assume it should be 9:05 AM (add 6 hours)
                if hour <= 3:
                    adjusted_time = original_time + timedelta(hours=6)
                # For 4-6 AM -> assume it should be 9-11 AM (add 5 hours)  
                else:
                    adjusted_time = original_time + timedelta(hours=5)
                
                print(f"Reminder '{reminder.title}': {original_time} -> {adjusted_time}")
                reminder.reminder_date = adjusted_time
                fixed_count += 1
        
        if fixed_count > 0:
            print(f"Fixing {fixed_count} reminders...")
            db.commit()
            print("✅ Reminder timezones fixed!")
        else:
            print("✅ No reminders needed fixing")
            
    except Exception as e:
        print(f"❌ Error fixing reminders: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Fixing reminder timezones...")
    fix_reminder_timezones()