"""Storage service with S3-compatible, GCS, and local filesystem backends."""

import json
import logging
import uuid as uuid_mod
from pathlib import Path

from apps.api.config import settings

logger = logging.getLogger(__name__)

_LOCAL_UPLOAD_DIR = Path("uploads")


def _get_s3_client():
    """Lazily initialise S3-compatible client. Returns ``None`` when not configured."""
    if not settings.aws_s3_bucket_name or not settings.aws_access_key_id:
        return None
    try:
        import boto3
        from botocore.config import Config

        client_kwargs = {
            "aws_access_key_id": settings.aws_access_key_id,
            "aws_secret_access_key": settings.aws_secret_access_key,
            "region_name": settings.aws_default_region,
            "config": Config(signature_version="s3v4"),
        }
        if settings.aws_endpoint_url:
            client_kwargs["endpoint_url"] = settings.aws_endpoint_url
        return boto3.client("s3", **client_kwargs)
    except Exception:
        logger.warning("S3 client init failed – trying GCS fallback", exc_info=True)
        return None


def _get_gcs_client():
    """Lazily initialise GCS client. Returns ``None`` when not configured."""
    if not settings.gcs_bucket_name:
        return None
    try:
        from google.cloud import storage

        if settings.gcs_credentials_json:
            info = json.loads(settings.gcs_credentials_json)
            return storage.Client.from_service_account_info(info)
        if settings.gcs_credentials_path:
            return storage.Client.from_service_account_json(
                settings.gcs_credentials_path
            )
        return storage.Client(project=settings.gcs_project_id)
    except Exception:
        logger.warning("GCS client init failed – using local fallback", exc_info=True)
        return None


class GCSStorageService:
    """Upload / download files via S3-compatible, GCS, or local filesystem."""

    def __init__(self) -> None:
        self._s3 = _get_s3_client()
        self._gcs = _get_gcs_client() if self._s3 is None else None

    @property
    def is_s3_available(self) -> bool:
        return self._s3 is not None and bool(settings.aws_s3_bucket_name)

    @property
    def is_gcs_available(self) -> bool:
        return self._gcs is not None and bool(settings.gcs_bucket_name)

    async def upload_file(
        self,
        content: bytes,
        destination_path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload *content* and return the resulting file URL."""
        if self.is_s3_available:
            return self._upload_to_s3(content, destination_path, content_type)
        if self.is_gcs_available:
            return self._upload_to_gcs(content, destination_path, content_type)
        return self._upload_to_local(content, destination_path)

    def _upload_to_s3(self, content: bytes, path: str, content_type: str) -> str:
        self._s3.put_object(
            Bucket=settings.aws_s3_bucket_name,
            Key=path,
            Body=content,
            ContentType=content_type,
        )
        if settings.aws_endpoint_url:
            return f"{settings.aws_endpoint_url}/{settings.aws_s3_bucket_name}/{path}"
        return f"https://{settings.aws_s3_bucket_name}.s3.{settings.aws_default_region}.amazonaws.com/{path}"

    def _upload_to_gcs(self, content: bytes, path: str, content_type: str) -> str:
        bucket = self._gcs.bucket(settings.gcs_bucket_name)
        blob = bucket.blob(path)
        blob.upload_from_string(content, content_type=content_type)
        return f"gs://{settings.gcs_bucket_name}/{path}"

    def _upload_to_local(self, content: bytes, path: str) -> str:
        dest = _LOCAL_UPLOAD_DIR / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return f"/uploads/{path}"

    def generate_signed_url(self, file_path: str, expiration_minutes: int = 60) -> str:
        """Return a temporary download URL."""
        if self.is_s3_available:
            return self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.aws_s3_bucket_name, "Key": file_path},
                ExpiresIn=expiration_minutes * 60,
            )
        if self.is_gcs_available:
            from datetime import timedelta

            bucket = self._gcs.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(file_path)
            return blob.generate_signed_url(
                expiration=timedelta(minutes=expiration_minutes)
            )
        return f"{settings.api_base_url.rstrip('/')}{file_path}"

    @staticmethod
    def build_source_path(product_id: str, file_name: str) -> str:
        """Convention: ``sources/{product_id}/{uuid8}_{original_name}``."""
        unique = uuid_mod.uuid4().hex[:8]
        safe_name = Path(file_name).name or "file.bin"
        return f"sources/{product_id}/{unique}_{safe_name}"
