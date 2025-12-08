"""
Migration to add media processing tables
Run this to create the new tables for AI media processing
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from dotenv import load_dotenv
from media_models import Base
import models

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")

def run_migration():
    """Create media processing tables"""
    print("Creating media processing tables...")
    
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
    )
    
    # Import all models to ensure they're registered
    from media_models import (
        MediaUpload, TranscriptionSegment, SpeakerSegment,
        GeneratedNote, MediaProcessingJob, BatchProcessing,
        PodcastSubscription, MediaTemplate
    )
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    print("✅ Media processing tables created successfully!")
    print("\nNew tables:")
    print("  - media_uploads")
    print("  - transcription_segments")
    print("  - speaker_segments")
    print("  - generated_notes")
    print("  - media_processing_jobs")
    print("  - batch_processing")
    print("  - podcast_subscriptions")
    print("  - media_templates")

if __name__ == "__main__":
    run_migration()
