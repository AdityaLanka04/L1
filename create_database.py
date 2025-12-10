#!/usr/bin/env python3
"""
Quick Database Setup Script
Run this from the root directory to create all database tables
"""

import sys
import os
sys.path.append('backend')

from backend.database import Base, DATABASE_URL, engine
import backend.models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_all_tables():
    """Create all database tables"""
    try:
        logger.info(f"Creating tables in database: {DATABASE_URL}")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        logger.info("✅ All tables created successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create tables: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("CREATING DATABASE TABLES")
    print("=" * 60)
    
    if create_all_tables():
        print("✅ Database setup complete!")
    else:
        print("❌ Database setup failed!")
        sys.exit(1)