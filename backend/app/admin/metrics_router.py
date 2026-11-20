from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth.deps import Auth, admin_reader
from ..core.database import get_session
from ..metrics import as_csv, latest, snapshot

router = APIRouter(prefix="/api/admin/metrics", tags=["admin-metrics"])


@router.get("")
def read(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    row = latest(session)
    if row is None:  # first visit before the worker ran: compute once
        row = snapshot(session)
        session.commit()
    return row.data


@router.get("/export.csv")
def export(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    row = latest(session)
    if row is None:
        raise HTTPException(404, "Metriche non ancora calcolate.")
    return Response(
        as_csv(row.data).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="metriche-vorya-qr.csv"'},
    )
