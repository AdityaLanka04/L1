"""
Media Manager
Orchestrates media processing, storage, and database operations
"""
from media_processor_unified import MediaProcessor
from storage_service import StorageService
import models
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)


class MediaManager:
    """
    Manages the complete media processing workflow:
    1. Upload original file to Cloudflare R2 (optional)
    2. Extract text from media
    3. Store extracted text in database
    4. Generate AI notes
    5. Store notes in database
    """
    
    def __init__(self):
        self.media_processor = MediaProcessor()
        self.storage = StorageService.get_storage()
        self.store_original_files = os.getenv("STORE_ORIGINAL_FILES", "false").lower() == "true"
    
    async def process_and_store(
        self,
        file,
        user_id: int,
        db: Session,
        store_file: bool = None
    ):
        """
        Process media file and store in database
        
        Args:
            file: UploadFile object
            user_id: User ID
            db: Database session
            store_file: Whether to store original file (overrides env setting)
            
        Returns:
            dict: {
                'media_file_id': int,
                'extracted_text': str,
                'metadata': dict,
                'file_url': str (if stored)
            }
        """
        # Determine if we should store the original file
        should_store = store_file if store_file is not None else self.store_original_files
        
        # Step 1: Extract text from media
        logger.info(f"Processing {file.filename} for user {user_id}")
        extraction_result = await self.media_processor.process_file(file)
        
        # Step 2: Optionally upload original file to R2
        storage_info = None
        if should_store:
            try:
                logger.info(f"Uploading original file to storage")
                storage_info = self.storage.upload_file(
                    file,
                    user_id,
                    extraction_result['type']
                )
            except Exception as e:
                logger.warning(f"Failed to upload file to storage: {e}")
                # Continue without storing file
        
        # Step 3: Store in database
        media_file = models.MediaFile(
            user_id=user_id,
            file_type=extraction_result['type'],
            original_filename=file.filename,
            file_size=file.size if hasattr(file, 'size') else None,
            storage_path=storage_info['storage_path'] if storage_info else None,
            storage_type=storage_info['storage_type'] if storage_info else None,
            extracted_text=extraction_result['text'],
            language=extraction_result['metadata'].get('language'),
            duration=extraction_result['metadata'].get('duration'),
            page_count=extraction_result['metadata'].get('page_count'),
            word_count=extraction_result['metadata']['word_count'],
            created_at=datetime.utcnow(),
            processed_at=datetime.utcnow()
        )
        
        db.add(media_file)
        db.commit()
        db.refresh(media_file)
        
        logger.info(f"Created media file record: {media_file.id}")
        
        return {
            'media_file_id': media_file.id,
            'extracted_text': extraction_result['text'],
            'metadata': extraction_result['metadata'],
            'file_url': storage_info['url'] if storage_info else None,
            'file_type': extraction_result['type']
        }
    
    async def process_youtube(
        self,
        url: str,
        user_id: int,
        db: Session
    ):
        """
        Process YouTube video and store in database
        
        Args:
            url: YouTube URL
            user_id: User ID
            db: Database session
            
        Returns:
            dict: Same as process_and_store
        """
        logger.info(f"Processing YouTube URL for user {user_id}")
        
        # Extract transcript
        extraction_result = await self.media_processor.process_youtube(url)
        
        # Store in database
        media_file = models.MediaFile(
            user_id=user_id,
            file_type='youtube',
            original_filename=url,
            file_size=None,
            storage_path=None,
            storage_type=None,
            extracted_text=extraction_result['text'],
            language=extraction_result['metadata'].get('language'),
            duration=extraction_result['metadata'].get('duration'),
            page_count=None,
            word_count=extraction_result['metadata']['word_count'],
            created_at=datetime.utcnow(),
            processed_at=datetime.utcnow()
        )
        
        db.add(media_file)
        db.commit()
        db.refresh(media_file)
        
        logger.info(f"Created YouTube media file record: {media_file.id}")
        
        return {
            'media_file_id': media_file.id,
            'extracted_text': extraction_result['text'],
            'metadata': extraction_result['metadata'],
            'file_url': f"https://youtube.com/watch?v={extraction_result['metadata']['video_id']}",
            'file_type': 'youtube'
        }
    
    def get_media_file(self, media_file_id: int, db: Session):
        """Get media file by ID"""
        return db.query(models.MediaFile).filter(
            models.MediaFile.id == media_file_id
        ).first()
    
    def get_user_media_files(self, user_id: int, db: Session, limit: int = 50):
        """Get all media files for a user"""
        return db.query(models.MediaFile).filter(
            models.MediaFile.user_id == user_id
        ).order_by(models.MediaFile.created_at.desc()).limit(limit).all()
    
    def delete_media_file(self, media_file_id: int, db: Session):
        """Delete media file and optionally remove from storage"""
        media_file = self.get_media_file(media_file_id, db)
        
        if not media_file:
            return False
        
        # Delete from storage if exists
        if media_file.storage_path:
            try:
                self.storage.delete_file(media_file.storage_path)
                logger.info(f"Deleted file from storage: {media_file.storage_path}")
            except Exception as e:
                logger.warning(f"Failed to delete file from storage: {e}")
        
        # Delete from database
        db.delete(media_file)
        db.commit()
        
        logger.info(f"Deleted media file: {media_file_id}")
        return True
    
    def get_file_url(self, media_file: models.MediaFile):
        """Get download URL for media file"""
        if not media_file.storage_path:
            return None
        
        return self.storage.get_file_url(media_file.storage_path)
    
    async def cleanup_old_files(self, db: Session, days: int = 30):
        """
        Delete original files older than X days (keep extracted text)
        This saves storage costs while preserving the important data
        """
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        old_files = db.query(models.MediaFile).filter(
            models.MediaFile.created_at < cutoff_date,
            models.MediaFile.storage_path.isnot(None),
            models.MediaFile.extracted_text.isnot(None)  # Only if we have the text
        ).all()
        
        deleted_count = 0
        for media_file in old_files:
            try:
                # Delete from storage
                self.storage.delete_file(media_file.storage_path)
                
                # Update database (keep record but remove storage reference)
                media_file.storage_path = None
                media_file.storage_type = None
                db.commit()
                
                deleted_count += 1
                logger.info(f"Cleaned up old file: {media_file.id}")
            except Exception as e:
                logger.error(f"Failed to cleanup file {media_file.id}: {e}")
        
        logger.info(f"Cleaned up {deleted_count} old files")
        return deleted_count
