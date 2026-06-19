import os
import uuid
import logging
from pathlib import Path
import shutil
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class StorageService:
    
    @staticmethod
    def get_storage():
        storage_type = os.getenv("STORAGE_TYPE", "local").lower()
        
        if storage_type == "s3":
            try:
                return S3Storage()
            except Exception as e:
                logger.warning(f"S3 not configured: {e}, falling back to local")
                return LocalStorage()
        elif storage_type == "r2":
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
    storage_type = "local"
    
    def __init__(self):
        self.base_path = Path(os.getenv("UPLOAD_DIR", "uploads"))
        self.base_path.mkdir(exist_ok=True, parents=True)
        logger.info(f"Using local storage at: {self.base_path}")
    
    def upload_file(self, file_obj, user_id, file_type):
        user_dir = self.base_path / str(user_id) / file_type
        user_dir.mkdir(parents=True, exist_ok=True)
        
        file_ext = file_obj.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = user_dir / unique_filename
        
        file_obj.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
        
        relative_path = str(file_path.relative_to(self.base_path))
        
        return {
            'storage_path': relative_path,
            'url': f"/uploads/{relative_path}",
            'storage_type': 'local'
        }

    def upload_bytes(self, content, storage_path, content_type=None):
        file_path = self.base_path / storage_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        relative_path = str(file_path.relative_to(self.base_path))
        return {
            'storage_path': relative_path,
            'url': f"/uploads/{relative_path}",
            'storage_type': 'local'
        }
    
    def get_file_url(self, storage_path):
        return f"/uploads/{storage_path}"

    def get_private_file_url(self, storage_path, expires_in=None):
        return self.get_file_url(storage_path)
    
    def delete_file(self, storage_path):
        file_path = self.base_path / storage_path
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {storage_path}")

    def download_file(self, storage_path, destination_path):
        src = self.base_path / storage_path
        if not src.exists():
            raise FileNotFoundError(storage_path)
        destination = Path(destination_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, destination)
        return destination
    
    def file_exists(self, storage_path):
        return (self.base_path / storage_path).exists()

class SupabaseStorage:
    storage_type = "supabase"
    
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
        file_ext = file_obj.filename.split('.')[-1]
        file_path = f"{user_id}/{file_type}/{uuid.uuid4()}.{file_ext}"
        
        file_obj.file.seek(0)
        response = self.supabase.storage.from_(self.bucket_name).upload(
            file_path,
            file_obj.file.read(),
            file_options={"content-type": file_obj.content_type}
        )
        
        url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
        
        return {
            'storage_path': file_path,
            'url': url,
            'storage_type': 'supabase'
        }
    
    def get_file_url(self, storage_path):
        return self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)

    def get_private_file_url(self, storage_path, expires_in=None):
        expires = expires_in or int(os.getenv("STORAGE_PRESIGNED_URL_TTL", "900"))
        signed = self.supabase.storage.from_(self.bucket_name).create_signed_url(storage_path, expires)
        return signed.get("signedURL") or signed.get("signed_url") or self.get_file_url(storage_path)
    
    def delete_file(self, storage_path):
        self.supabase.storage.from_(self.bucket_name).remove([storage_path])
        logger.info(f"Deleted file from Supabase: {storage_path}")
    
    def file_exists(self, storage_path):
        try:
            self.supabase.storage.from_(self.bucket_name).get_public_url(storage_path)
            return True
        except:
            return False

class S3Storage:
    storage_type = "s3"

    def __init__(self):
        try:
            import boto3

            bucket = os.getenv("AWS_S3_BUCKET") or os.getenv("S3_BUCKET_NAME")
            region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
            endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL") or None

            if not bucket:
                raise ValueError("AWS_S3_BUCKET or S3_BUCKET_NAME must be set")

            client_kwargs = {"region_name": region}
            if endpoint_url:
                client_kwargs["endpoint_url"] = endpoint_url
            if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
                client_kwargs["aws_access_key_id"] = os.getenv("AWS_ACCESS_KEY_ID")
                client_kwargs["aws_secret_access_key"] = os.getenv("AWS_SECRET_ACCESS_KEY")

            self.s3 = boto3.client("s3", **client_kwargs)
            self.bucket = bucket
            self.region = region
            self.public_url = (os.getenv("AWS_S3_PUBLIC_URL") or "").rstrip("/")
            self.presign_ttl = int(os.getenv("AWS_S3_PRESIGNED_URL_TTL") or os.getenv("STORAGE_PRESIGNED_URL_TTL", "900"))
            logger.info(f"Using S3 storage, bucket: {bucket}, region: {region}")

        except ImportError:
            raise ValueError("boto3 package not installed. Run: pip install boto3")

    @staticmethod
    def _extension(filename):
        name = filename or "upload"
        return name.rsplit(".", 1)[-1] if "." in name else "bin"

    def upload_file(self, file_obj, user_id, file_type):
        file_ext = self._extension(file_obj.filename)
        file_key = f"media/{user_id}/{file_type}/{uuid.uuid4()}.{file_ext}"

        file_obj.file.seek(0)
        extra_args = {}
        if getattr(file_obj, "content_type", None):
            extra_args["ContentType"] = file_obj.content_type
        self.s3.upload_fileobj(
            file_obj.file,
            self.bucket,
            file_key,
            ExtraArgs=extra_args or None,
        )

        return {
            "storage_path": file_key,
            "url": self.get_file_url(file_key),
            "storage_type": "s3",
        }

    def upload_bytes(self, content, storage_path, content_type=None):
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        self.s3.put_object(
            Bucket=self.bucket,
            Key=storage_path,
            Body=content,
            **extra_args,
        )
        return {
            "storage_path": storage_path,
            "url": self.get_file_url(storage_path),
            "storage_type": "s3",
        }

    def get_file_url(self, storage_path):
        if self.public_url:
            return f"{self.public_url}/{storage_path}"
        return self.get_private_file_url(storage_path)

    def get_private_file_url(self, storage_path, expires_in=None):
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": storage_path},
            ExpiresIn=expires_in or self.presign_ttl,
        )

    def delete_file(self, storage_path):
        self.s3.delete_object(Bucket=self.bucket, Key=storage_path)
        logger.info(f"Deleted file from S3: {storage_path}")

    def download_file(self, storage_path, destination_path):
        destination = Path(destination_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.s3.download_file(self.bucket, storage_path, str(destination))
        return destination

    def file_exists(self, storage_path):
        try:
            self.s3.head_object(Bucket=self.bucket, Key=storage_path)
            return True
        except Exception:
            return False

    def uri_for_path(self, storage_path):
        return f"s3://{self.bucket}/{storage_path}"

    def path_from_uri(self, uri):
        parsed = urlparse(uri)
        if parsed.scheme != "s3":
            return uri
        return parsed.path.lstrip("/")

class R2Storage:
    storage_type = "r2"
    
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
        file_ext = file_obj.filename.split('.')[-1]
        file_key = f"media/{user_id}/{file_type}/{uuid.uuid4()}.{file_ext}"
        
        file_obj.file.seek(0)
        self.s3.upload_fileobj(
            file_obj.file,
            self.bucket,
            file_key,
            ExtraArgs={'ContentType': file_obj.content_type}
        )
        
        if self.public_url:
            url = f"{self.public_url}/{file_key}"
        else:
            url = f"https://{self.bucket}.r2.cloudflarestorage.com/{file_key}"
        
        return {
            'storage_path': file_key,
            'url': url,
            'storage_type': 'r2'
        }

    def upload_bytes(self, content, storage_path, content_type=None):
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        self.s3.put_object(
            Bucket=self.bucket,
            Key=storage_path,
            Body=content,
            **extra_args,
        )
        return {
            "storage_path": storage_path,
            "url": self.get_file_url(storage_path),
            "storage_type": "r2",
        }
    
    def get_file_url(self, storage_path):
        if self.public_url:
            return f"{self.public_url}/{storage_path}"
        return f"https://{self.bucket}.r2.cloudflarestorage.com/{storage_path}"

    def get_private_file_url(self, storage_path, expires_in=None):
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": storage_path},
            ExpiresIn=expires_in or int(os.getenv("STORAGE_PRESIGNED_URL_TTL", "900")),
        )
    
    def delete_file(self, storage_path):
        self.s3.delete_object(Bucket=self.bucket, Key=storage_path)
        logger.info(f"Deleted file from R2: {storage_path}")

    def download_file(self, storage_path, destination_path):
        destination = Path(destination_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.s3.download_file(self.bucket, storage_path, str(destination))
        return destination
    
    def file_exists(self, storage_path):
        try:
            self.s3.head_object(Bucket=self.bucket, Key=storage_path)
            return True
        except:
            return False

    def uri_for_path(self, storage_path):
        return f"r2://{self.bucket}/{storage_path}"
