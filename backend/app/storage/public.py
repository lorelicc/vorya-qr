"""Public file delivery: GET /f/{file_id}/{variant}.

Served with the sniffed Content-Type, nosniff, a sandboxing CSP and Range support (iPhone
needs 206 responses to play and seek audio). Only files of live companies in non-suspended
workspaces are served; ids are random UUIDs.
"""

import re

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select

from ..core.database import session_factory
from ..models import Company, StoredFile, Workspace
from .backends import get_storage

router = APIRouter(tags=["files"])
FILE_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
VARIANT = re.compile(r"^[a-z0-9_]{1,24}$")
RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")
SECURITY = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Accept-Ranges": "bytes",
}


def not_found() -> Response:
    return Response("File non disponibile.", status_code=404, media_type="text/plain",
                    headers={"Cache-Control": "no-store", **SECURITY})  # fmt: skip


def parse_range(header: str | None, size: int) -> tuple[int, int] | None | bool:
    """(start, end) for a satisfiable single range, None without header, False if invalid."""
    if not header:
        return None
    match = RANGE.match(header.strip())
    if not match or (not match[1] and not match[2]):
        return False
    if not match[1]:  # suffix range: last N bytes
        length = int(match[2])
        return (max(size - length, 0), size - 1) if length else False
    start = int(match[1])
    end = min(int(match[2]), size - 1) if match[2] else size - 1
    return (start, end) if start <= end and start < size else False


@router.api_route("/f/{file_id}/{variant}", methods=["GET", "HEAD"], include_in_schema=False)
def serve(file_id: str, variant: str, request: Request, download: bool = Query(default=False)):
    if not FILE_ID.match(file_id) or not VARIANT.match(variant):
        return not_found()
    with session_factory()() as session:
        row = session.execute(
            select(StoredFile.variants, StoredFile.original_name)
            .join(Company, Company.id == StoredFile.company_id)
            .join(Workspace, Workspace.id == Company.workspace_id)
            .where(
                StoredFile.id == file_id, StoredFile.deleted_at.is_(None),
                Company.deleted_at.is_(None), Workspace.status != "suspended",
            )
        ).one_or_none()  # fmt: skip
    info = row.variants.get(variant) if row else None
    if not info:
        return not_found()
    storage, size = get_storage(), info["size"]
    disposition = "attachment" if download else "inline"
    safe_name = re.sub(r"[^\w.\- ]", "_", row.original_name)[:120] or "file"
    headers = {
        **SECURITY,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": f'{disposition}; filename="{safe_name}"',
    }
    byte_range = parse_range(request.headers.get("range"), size)
    if byte_range is False:
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
    start, end = byte_range or (0, size - 1)
    headers["Content-Length"] = str(end - start + 1)
    status = 200
    if byte_range:
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    if request.method == "HEAD":
        return Response(status_code=status, headers=headers, media_type=info["mime"])
    return StreamingResponse(storage.read(info["key"], start, end), status_code=status,
                             headers=headers, media_type=info["mime"])  # fmt: skip
