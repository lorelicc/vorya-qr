import io
import json
from datetime import timedelta
from pathlib import Path

import boto3
from moto import mock_aws
from PIL import Image
from sqlalchemy import select, update

from app.core.security import now
from app.models import Plan, StoredFile, Workspace
from app.storage.backends import S3Storage
from app.worker import run_once
from tests.conftest import STORAGE_DIR, company_id, csrf, signup

MP3 = b"ID3\x04\x00\x00\x00\x00\x00\x00" + b"\xff\xfb\x90\x00" + b"\x00" * 4000
WAV = b"RIFF\x24\x08\x00\x00WAVEfmt " + b"\x00" * 2000


def jpeg_with_gps() -> bytes:
    image = Image.new("RGB", (1200, 800), "#087f5b")
    exif = Image.Exif()
    exif[0x010F] = "VoryaCam"  # Make
    exif[0x8825] = {2: (45, 28, 0), 4: (9, 11, 0)}  # GPSInfo
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=exif)
    return buffer.getvalue()


def pdf_bytes(pages: int = 2) -> bytes:
    buffer = io.BytesIO()
    frames = [Image.new("RGB", (595, 842), color) for color in ("white", "#d8fae9")[:pages]]
    frames[0].save(buffer, "PDF", save_all=True, append_images=frames[1:])
    return buffer.getvalue()


def upload(client, data: bytes, purpose: str, name="file.bin", cid=None):
    cid = cid or company_id(client)
    headers = {k: v for k, v in csrf(client).items()}
    return client.post(
        f"/api/companies/{cid}/files",
        files={"file": (name, data, "application/octet-stream")},
        data={"purpose": purpose},
        headers=headers,
    )


def test_image_upload_strips_exif_and_builds_webp_variants(client):
    signup(client)
    response = upload(client, jpeg_with_gps(), "image", "foto.jpg")
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["kind"] == "image" and set(data["urls"]) == {"large", "thumb"}
    image_bytes = client.get(data["urls"]["large"]).content
    image = Image.open(io.BytesIO(image_bytes))
    assert image.format == "WEBP" and image.size == (1200, 800)
    assert not image.getexif() and "exif" not in image.info


def test_pdf_upload_has_page_previews(client):
    signup(client)
    data = upload(client, pdf_bytes(2), "pdf", "menu.pdf").json()
    assert data["page_count"] == 2
    assert set(data["urls"]) == {"original", "page_1", "page_2"}
    original = client.get(data["urls"]["original"])
    assert original.headers["content-type"] == "application/pdf"
    assert original.content.startswith(b"%PDF-")


def test_audio_uploads_by_magic_bytes(client):
    signup(client)
    assert upload(client, MP3, "audio", "traccia.mp3").json()["mime"] == "audio/mpeg"
    assert upload(client, WAV, "audio", "traccia.wav").json()["mime"] == "audio/wav"


def test_rejected_types(client):
    signup(client)
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    response = upload(client, svg, "image", "logo.svg")
    assert response.status_code == 415 and "SVG" in response.json()["detail"]
    assert upload(client, b"<html>ciao</html>", "image", "finta.png").status_code == 415
    assert upload(client, pdf_bytes(1), "image", "doc.pdf").status_code == 415  # wrong purpose
    assert upload(client, b"%PDF-1.7 broken", "pdf", "rotto.pdf").status_code == 422
    assert upload(client, MP3, "boh").status_code == 422


def test_file_size_limit_follows_plan(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.features = {**plan.features, "max_file_mb": 1}
    db.commit()
    response = upload(client, MP3 + b"\x00" * (1024 * 1024), "audio")
    assert response.status_code == 413 and response.json()["code"] == "file_too_large"


def test_storage_quota_is_enforced_and_reported(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.features = {**plan.features, "storage_mb": 1}
    db.commit()
    first = upload(client, MP3 + b"\x00" * 600_000, "audio")
    assert first.status_code == 201
    second = upload(client, MP3 + b"\x00" * 600_000, "audio")
    assert second.status_code == 409 and second.json()["code"] == "quota_storage"
    usage = client.get("/api/account/plan").json()["usage"]["storage"]
    assert usage["used"] == first.json()["size_bytes"] and usage["limit"] == 1024 * 1024
    stored = list(Path(STORAGE_DIR).rglob("original"))
    assert len(stored) == 1  # the refused upload left no bytes behind


def test_range_requests_and_security_headers(client):
    signup(client)
    data = upload(client, MP3, "audio", "traccia.mp3").json()
    url = data["urls"]["original"]
    full = client.get(url)
    assert full.status_code == 200 and full.headers["accept-ranges"] == "bytes"
    assert full.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in full.headers["content-security-policy"]
    part = client.get(url, headers={"Range": "bytes=0-9"})
    assert part.status_code == 206 and part.content == MP3[:10]
    assert part.headers["content-range"] == f"bytes 0-9/{len(MP3)}"
    tail = client.get(url, headers={"Range": "bytes=-4"})
    assert tail.status_code == 206 and tail.content == MP3[-4:]
    assert client.get(url, headers={"Range": f"bytes={len(MP3) + 5}-"}).status_code == 416
    head = client.head(url, headers={"Range": "bytes=10-19"})
    assert head.status_code == 206 and head.headers["content-length"] == "10"
    download = client.get(f"{url}?download=1")
    assert download.headers["content-disposition"].startswith("attachment;")
    assert client.get("/f/not-a-uuid/original").status_code == 404


def test_deleted_files_and_suspended_workspaces_are_not_served(client, db):
    signup(client)
    data = upload(client, MP3, "audio").json()
    url = data["urls"]["original"]
    db.execute(update(Workspace).values(status="suspended"))
    db.commit()
    assert client.get(url).status_code == 404
    db.execute(update(Workspace).values(status="active"))
    db.commit()
    cid = company_id(client)
    listing = client.get(f"/api/companies/{cid}/files").json()
    assert [f["id"] for f in listing["files"]] == [data["id"]]
    assert (
        client.delete(f"/api/companies/{cid}/files/{data['id']}", headers=csrf(client)).status_code
        == 204
    )
    assert client.get(url).status_code == 404
    assert client.get(f"/api/companies/{cid}/files").json()["files"] == []


def test_files_are_isolated_between_accounts(client):
    signup(client, "a@example.com")
    cid = company_id(client)
    data = upload(client, MP3, "audio").json()
    client.cookies.clear()
    signup(client, "b@example.com")
    assert (
        client.delete(f"/api/companies/{cid}/files/{data['id']}", headers=csrf(client)).status_code
        == 404
    )
    assert upload(client, MP3, "audio", cid=cid).status_code == 404
    own = company_id(client)
    assert (
        client.delete(f"/api/companies/{own}/files/{data['id']}", headers=csrf(client)).status_code
        == 404
    )


def test_company_logo(client):
    signup(client)
    cid = company_id(client)
    png = io.BytesIO()
    Image.new("RGBA", (800, 400), (0, 233, 154, 255)).save(png, "PNG")
    files = {"file": ("logo.png", png.getvalue())}
    response = client.post(f"/api/companies/{cid}/logo", files=files, headers=csrf(client))
    assert response.status_code == 200
    logo_url = client.get(f"/api/companies/{cid}").json()["logo_url"]
    assert logo_url == response.json()["logo_url"]
    assert Image.open(io.BytesIO(client.get(logo_url).content)).size == (512, 256)
    assert client.delete(f"/api/companies/{cid}/logo", headers=csrf(client)).status_code == 204
    assert client.get(f"/api/companies/{cid}").json()["logo_url"] is None


def test_upload_rate_limit(client, monkeypatch):
    import app.storage.router as files_router

    monkeypatch.setattr(files_router, "UPLOADS_PER_WINDOW", 2)
    signup(client)
    assert upload(client, MP3, "audio").status_code == 201
    assert upload(client, MP3, "audio").status_code == 201
    assert upload(client, MP3, "audio").status_code == 429


def test_worker_deletes_bytes_after_30_days(client, db):
    signup(client)
    data = upload(client, MP3, "audio").json()
    cid = company_id(client)
    client.delete(f"/api/companies/{cid}/files/{data['id']}", headers=csrf(client))
    assert list(Path(STORAGE_DIR).rglob(data["id"]))
    db.execute(update(StoredFile).values(purge_after=now() - timedelta(minutes=1)))
    db.commit()
    assert run_once()["purge_files"] == 1
    assert (
        not list(Path(STORAGE_DIR).rglob("original"))
        or not (Path(STORAGE_DIR) / "files" / data["id"]).exists()
    )
    db.expire_all()
    assert db.scalar(select(StoredFile)).purged_at is not None


def test_transfer_counts_and_moves_storage(client, db):
    from tests.test_transfers import RECIPIENT, as_user, request_transfer, setup_pair

    cid, _ = setup_pair(client)
    upload(client, MP3 + b"\x00" * 600_000, "audio", cid=cid)
    tid = request_transfer(client, cid).json()["id"]
    recipient_ws = db.scalar(select(Workspace).order_by(Workspace.id))
    pro = db.get(Plan, "pro")
    pro.features = {**pro.features, "storage_mb": 0}
    db.commit()
    as_user(client, RECIPIENT)
    refused = client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client))
    assert refused.status_code == 409 and "archiviazione" in refused.json()["detail"]
    pro.features = {**pro.features, "storage_mb": 1024}
    db.commit()
    assert (
        client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client)).status_code == 200
    )
    db.expire_all()
    assert db.scalar(select(StoredFile)).workspace_id == recipient_ws.id


@mock_aws
def test_s3_driver_roundtrip(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("STORAGE_S3_BUCKET", "vorya-test")
    monkeypatch.setenv("STORAGE_S3_REGION", "eu-west-1")
    get_settings.cache_clear()
    try:
        boto3.client("s3", region_name="eu-west-1").create_bucket(
            Bucket="vorya-test", CreateBucketConfiguration={"LocationConstraint": "eu-west-1"}
        )
        storage = S3Storage()
        key = "files/0f8fad5b-d9cb-469f-a165-70867728950e/original"
        storage.put(key, b"0123456789", "audio/mpeg")
        assert storage.size(key) == 10
        assert b"".join(storage.read(key, 2, 5)) == b"2345"
        storage.delete(key)
        assert json.dumps({"ok": True})
    finally:
        get_settings.cache_clear()
