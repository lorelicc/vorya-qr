"""Storage drivers behind one small interface.

Keys are opaque ("files/<uuid>/<variant>") and never contain user input or ownership, so
moving a company between accounts never moves bytes.
"""

import contextlib
import os
import re
import tempfile
from abc import ABC, abstractmethod
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from ..core.config import get_settings

KEY = re.compile(r"^files/[0-9a-f-]{36}/[a-z0-9_]{1,24}$")
CHUNK = 64 * 1024


def check_key(key: str) -> str:
    if not KEY.match(key):
        raise ValueError("Chiave di storage non valida")
    return key


class Storage(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    def size(self, key: str) -> int: ...

    @abstractmethod
    def read(self, key: str, start: int = 0, end: int | None = None) -> Iterator[bytes]:
        """Yields bytes [start, end] inclusive (end=None means until the end)."""

    @abstractmethod
    def delete(self, key: str) -> None: ...


class LocalStorage(Storage):
    def __init__(self, root: str):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        return self.root / check_key(key)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write: never expose a half-written file.
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".upload-")
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(tmp, path)

    def size(self, key: str) -> int:
        return self._path(key).stat().st_size

    def read(self, key: str, start: int = 0, end: int | None = None) -> Iterator[bytes]:
        path = self._path(key)
        last = path.stat().st_size - 1 if end is None else end
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = last - start + 1
            while remaining > 0:
                chunk = handle.read(min(CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    def delete(self, key: str) -> None:
        path = self._path(key)
        path.unlink(missing_ok=True)
        with contextlib.suppress(OSError):
            path.parent.rmdir()


class S3Storage(Storage):
    """Any S3-compatible service (e.g. OVHcloud Object Storage)."""

    def __init__(self):
        import boto3

        s = get_settings()
        self.bucket, self.prefix = s.storage_s3_bucket, s.storage_s3_prefix
        self.client = boto3.client(
            "s3",
            endpoint_url=s.storage_s3_endpoint or None,
            region_name=s.storage_s3_region or None,
            aws_access_key_id=s.storage_s3_access_key.get_secret_value() or None,
            aws_secret_access_key=s.storage_s3_secret_key.get_secret_value() or None,
        )

    def _key(self, key: str) -> str:
        return f"{self.prefix}{check_key(key)}"

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket, Key=self._key(key), Body=data, ContentType=content_type
        )

    def size(self, key: str) -> int:
        return self.client.head_object(Bucket=self.bucket, Key=self._key(key))["ContentLength"]

    def read(self, key: str, start: int = 0, end: int | None = None) -> Iterator[bytes]:
        byte_range = f"bytes={start}-{'' if end is None else end}"
        body = self.client.get_object(Bucket=self.bucket, Key=self._key(key), Range=byte_range)[
            "Body"
        ]
        yield from body.iter_chunks(CHUNK)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=self._key(key))


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    if settings.storage_driver == "s3":
        return S3Storage()
    return LocalStorage(settings.storage_local_path)
