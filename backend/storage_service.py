"""
Cloud Storage Service
Supports multiple storage backends: Supabase, Cloudflare R2, Local
"""
import os
import uuid
import logging
from pathlib import Path
import shutil

logger = logging.getLogger(__name__)


class StorageService:
    """Factory for storage services"""
    
    @staticmethod
    def get_storage():
        """Get configured storage service - defaults to R2 for production"""
        storage_type = os.getenv("STORAGE_TYPE", "r2").lower()
        
        if storage_type == "r2":
            # Try R2 first (best for production)
            try:
                return R2Storage()
            except Exception as e:
                logger.warning(f"R2 not configured: {e}, falling back to local")
                return LocalStorage()
        elif storage_type == "supabase":
            return SupabaseStorage()
        elif storage_type == "local":
            return LocalStorage()
        else:
            logger.warning(f"Unknown storage type: {storage_type}, using local")
            return LocalStorage()


class LocalStorage:
    """Local file storage"""
    
    def __init__(self):
        self.base_path = Path(os.getenv("UPLOAD_DIR", "uploads"))
        self.base_path.mkdir(exist_ok=True, parents=True)
        logger.info(f"Using local storage at: {self.base_path}")
    
    def upload_file(self, file_obj, user_id, file_type):
        """Upload file to local storage"""
        # Create user directory
        user_dir = self.base_path / str(user_id) / file_type
        user_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_ext = file_obj.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = user_dir / unique_filename
        
        # Save file
        file_obj.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
        
        # Return relative path
        relative_path = str(file_path.relative_to(self.base_path))
        
        return {
            'storage_path': relative_path,
            'url': f"/uploads/{relative_path}",
            'storage_type': 'local'
        }
    
    def get_file_url(self, storage_path):
        """Get file URL"""
        return f"/uploads/{storage_path}"
    
    def delete_file(self, storage_path):
        """Delete file"""
        file_path = self.base_path / storage_path
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {storage_path}")
    
    def file_exists(self, storage_path):
        """Check if file exists"""
        return (self.base_path / storage_path).exists()


class SupabaseStorage:
    """Supabase cloud storage"""
    
    def __init__(self):
        try:
            from supabase import create_client, Client
            
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
            
            self.supabase: Client = create_client(url, key)
            self.bucket_name = os.getenv("SUPABASE_BUCKET", "media-files")
            logger.info(f"Using Supabase storage, bucket: {self.bucket_name}")
            
        except ImportError:
            raise ValueError("supabase package not installed. Run: pip install supabase")
    
    def upload_file(self, file_obj, user_id, file_type):
        """Upload file to Supabase Storage"""
        # Generate file path
        file_ext = file_obj.filename.split('.')[-1]
        file_path = f"{user_id}/{file_type}/{uuid.uuid4()}.{file_ext}"
        
        # Upload
        file_obj.file.seek(0)
        response = self.supabase.storage.from_(self.bucket_name).upload(
            file_path,
            file_obj.file.read(),
            file_options={"content-type": file_obj.content_type}
        )
        
        # Get public URL
        url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
        
        return {
            'storage_path': file_path,
            'url': url,
            'storage_type': 'supabase'
        }
    
    def get_file_url(self, storage_path):
        """Get file URL"""
        return self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)
    
    def delete_file(self, storage_path):
        """Delete file"""
        self.supabase.storage.from_(self.bucket_name).remove([storage_path])
        logger.info(f"Deleted file from Supabase: {storage_path}")
    
    def file_exists(self, storage_path):
        """Check if file exists"""
        try:
            self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)
            return True
        except:
            return False


class R2Storage:
    """Cloudflare R2 storage"""
    
    def __init__(self):
        try:
            import boto3
            
            account_id = os.getenv("CF_ACCOUNT_ID")
            access_key = os.getenv("R2_ACCESS_KEY_ID")
            secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
            bucket = os.getenv("R2_BUCKET_NAME")
            
            if not all([account_id, access_key, secret_key, bucket]):
                raise ValueError("R2 credentials not configured")
            
            self.s3 = boto3.client(
                's3',
                endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name='auto'
            )
            self.bucket = bucket
            self.public_url = os.getenv("R2_PUBLIC_URL", "")
            logger.info(f"Using Cloudflare R2 storage, bucket: {bucket}")
            
        except ImportError:
            raise ValueError("boto3 package not installed. Run: pip install boto3")
    
    def upload_file(self, file_obj, user_id, file_type):
        """Upload file to R2"""
        file_ext = file_obj.filename.split('.')[-1]
        file_key = f"media/{user_id}/{file_type}/{uuid.uuid4()}.{file_ext}"
        
        file_obj.file.seek(0)
        self.s3.upload_fileobj(
            file_obj.file,
            self.bucket,
            file_key,
            ExtraArgs={'ContentType': file_obj.content_type}
        )
        
        # Generate URL
        if self.public_url:
            url = f"{self.public_url}/{file_key}"
        else:
            url = f"https://{self.bucket}.r2.cloudflarestorage.com/{file_key}"
        
        return {
            'storage_path': file_key,
            'url': url,
            'storage_type': 'r2'
        }
    
    def get_file_url(self, storage_path):
        """Get file URL"""
        if self.public_url:
            return f"{self.public_url}/{storage_path}"
        return f"https://{self.bucket}.r2.cloudflarestorage.com/{storage_path}"
    
    def delete_file(self, storage_path):
        """Delete file"""
        self.s3.delete_object(Bucket=self.bucket, Key=storage_path)
        logger.info(f"Deleted file from R2: {storage_path}")
    
    def file_exists(self, storage_path):
        """Check if file exists"""
        try:
            self.s3.head_object(Bucket=self.bucket, Key=storage_path)
            return True
        except:
            return False
