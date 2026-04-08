from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_enabled_menu
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.hunt_session import HuntSession
from app.schemas.hunts import (
    HuntDropRow,
    HuntDropsOcrResponse,
    HuntDropSummary,
    HuntSessionSaveRequest,
    HuntSessionListItem,
    HuntSessionDetail,
    HuntConsumableEntry,
)
from app.services.hunt_item_aliases import (
    normalize_item_name,
    register_observed_item,
    resolve_canonical_name,
)
from app.services.hunt_npc_prices import get_npc_unit_price_from_ocr_context
from app.services.hunts_ocr import (
    deduplicate_drop_lines,
    extract_drop_lines_from_image,
    refresh_approved_aliases_cache,
)
from app.services.ocr_debug_settings import is_ocr_debug_enabled
from app.services.hunts_prices import (
    get_account_player_prices,
    save_account_player_price,
)

router = APIRouter(
    prefix="/hunts",
    tags=["hunts"],
    dependencies=[Depends(require_enabled_menu("hunts"))],
)


class SavePlayerPricePayload(BaseModel):
    item_name: str
    player_unit_price: float


class OcrManualReviewRequest(BaseModel):
    session_id: str
    note: str | None = None


def _safe_debug_filename(name: str, fallback: str) -> str:
    safe = (name or "").replace(" ", "_")
    safe = "".join(char for char in safe if char.isalnum() or char in {"_", ".", "-"})
    return safe or fallback


def _build_ocr_report_text(report: dict) -> str:
    lines = [
        f"session_id: {report.get('session_id', '')}",
        f"debug_ocr_enabled: {report.get('debug_ocr_enabled', False)}",
        f"character_id: {report.get('character_id', '')}",
        f"total_files_received: {report.get('total_files_received', 0)}",
        f"processed_images: {report.get('processed_images', 0)}",
        f"recognized_lines: {report.get('recognized_lines', 0)}",
        f"duplicates_ignored: {report.get('duplicates_ignored', 0)}",
        f"final_rows: {report.get('final_rows', 0)}",
        f"warnings_count: {len(report.get('warnings', []))}",
        f"elapsed_ms: {report.get('elapsed_ms', 0)}",
        "",
        "warnings:",
    ]

    for warning in report.get("warnings", []):
        lines.append(f"- {warning}")

    lines.append("")
    lines.append("files:")

    for file_item in report.get("files", []):
        lines.append(
            "- "
            f"name={file_item.get('file_name')} "
            f"status={file_item.get('status')} "
            f"size_bytes={file_item.get('size_bytes')} "
            f"elapsed_ms={file_item.get('elapsed_ms')} "
            f"recognized_lines={file_item.get('recognized_lines')}"
        )
        if file_item.get("error_detail"):
            lines.append(f"  error_detail={file_item.get('error_detail')}")

    return "\n".join(lines).strip() + "\n"


@router.post("/ocr/drops", response_model=HuntDropsOcrResponse)
async def process_drops_ocr(
    character_id: int | None = Form(default=None),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HuntDropsOcrResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Nenhuma imagem enviada.")

    if len(files) > settings.ocr_max_files:
        raise HTTPException(
            status_code=400,
            detail=f"Limite de arquivos excedido. Máximo permitido: {settings.ocr_max_files}.",
        )

    refresh_approved_aliases_cache(db)

    recognized_lines = []
    warnings: list[str] = []
    max_file_size_bytes = settings.ocr_max_file_size_mb * 1024 * 1024
    ocr_timeout_seconds = settings.ocr_image_timeout_seconds
    request_started = time.perf_counter()
    file_reports: list[dict] = []
    session_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
    debug_root = Path(__file__).resolve().parents[1] / "data" / "ocr_debug"
    session_dir = debug_root / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    debug_ocr = is_ocr_debug_enabled()

    for index, upload in enumerate(files, start=1):
        started_at = time.perf_counter()
        file_name = upload.filename or f"imagem_{index}"
        file_report = {
            "file_name": file_name,
            "content_type": upload.content_type or "",
            "status": "ignored",
            "size_bytes": 0,
            "recognized_lines": 0,
            "elapsed_ms": 0,
            "error_detail": "",
        }

        if not upload.content_type or not upload.content_type.startswith("image/"):
            warnings.append(f"Imagem invalida: {file_name}")
            file_report["status"] = "invalid_content_type"
            file_reports.append(file_report)
            continue

        content = await upload.read()
        file_report["size_bytes"] = len(content)

        original_name = _safe_debug_filename(file_name, f"image_{index:02d}.png")
        (session_dir / f"{index:02d}_original_{original_name}").write_bytes(content)

        if len(content) > max_file_size_bytes:
            warnings.append(f"Arquivo muito grande: {file_name}")
            file_report["status"] = "file_too_large"
            file_report["error_detail"] = f"size={len(content)} limit={max_file_size_bytes}"
            file_report["elapsed_ms"] = int((time.perf_counter() - started_at) * 1000)
            file_reports.append(file_report)
            continue

        before_lines = len(recognized_lines)
        debug_notes: list[str] = []
        image_debug_dir = None
        if debug_ocr:
            image_name = file_name.replace(" ", "_")
            image_name = "".join(char for char in image_name if char.isalnum() or char in {"_", ".", "-"})
            image_debug_dir = session_dir / f"{index:02d}_{image_name}"

        try:
            parsed_lines = await asyncio.wait_for(
                asyncio.to_thread(
                    extract_drop_lines_from_image,
                    content,
                    image_debug_dir,
                    debug_notes,
                    settings.ocr_tesseract_lang,
                    settings.ocr_tesseract_oem,
                ),
                timeout=ocr_timeout_seconds,
            )
            recognized_lines.extend(parsed_lines)
            file_report["recognized_lines"] = len(parsed_lines)
            file_report["status"] = "ok" if parsed_lines else "no_lines"
            if len(recognized_lines) == before_lines:
                warnings.append(f"Imagem invalida: {file_name}")
        except TimeoutError:
            warnings.append(f"Tempo excedido no OCR: {file_name}")
            file_report["status"] = "timeout"
            file_report["error_detail"] = f"timeout={ocr_timeout_seconds}s"
        except Exception as exc:
            warnings.append(f"Imagem invalida: {file_name}")
            file_report["status"] = "processing_error"
            file_report["error_detail"] = str(exc)

        file_report["elapsed_ms"] = int((time.perf_counter() - started_at) * 1000)
        if debug_notes:
            file_report["debug_notes"] = debug_notes
        file_reports.append(file_report)

    unique_lines, duplicates_ignored = deduplicate_drop_lines(recognized_lines)
    player_prices = get_account_player_prices(current_user.id)

    seen_row_keys: set[str] = set()
    rows: list[HuntDropRow] = []
    for line in unique_lines:
        register_observed_item(db, line.name_display)

        canonical_name = resolve_canonical_name(db, line.name_display)
        canonical_normalized = normalize_item_name(canonical_name)
        row_key = f"{canonical_normalized}:{int(line.quantity)}:{line.npc_total_price:.2f}"

        if row_key in seen_row_keys:
            duplicates_ignored += 1
            continue

        seen_row_keys.add(row_key)
        player_unit = float(player_prices.get(canonical_normalized, 0))
        npc_unit = get_npc_unit_price_from_ocr_context(
            item_name=canonical_name,
            quantity=line.quantity,
            ocr_total_price=line.npc_total_price,
        )
        row_id = len(rows) + 1
        rows.append(
            HuntDropRow(
                id=row_id,
                name=canonical_name,
                name_display=canonical_name,
                name_normalized=canonical_normalized,
                quantity=line.quantity,
                npc_total_price=npc_unit * line.quantity,
                npc_unit_price=npc_unit,
                player_unit_price=player_unit,
                player_total_price=player_unit * line.quantity,
                duplicate_key=row_key,
            )
        )

    db.commit()

    report = {
        "session_id": session_id,
        "debug_ocr_enabled": debug_ocr,
        "character_id": character_id,
        "total_files_received": len(files),
        "processed_images": len(files),
        "recognized_lines": len(recognized_lines),
        "duplicates_ignored": duplicates_ignored,
        "final_rows": len(rows),
        "warnings": warnings,
        "elapsed_ms": int((time.perf_counter() - request_started) * 1000),
        "files": file_reports,
        "created_at": datetime.utcnow().isoformat(),
    }

    (session_dir / "ocr_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (session_dir / "ocr_report.txt").write_text(
        _build_ocr_report_text(report),
        encoding="utf-8",
    )

    return HuntDropsOcrResponse(
        rows=rows,
        summary=HuntDropSummary(
            processed_images=len(files),
            recognized_lines=len(recognized_lines),
            duplicates_ignored=duplicates_ignored,
            final_rows=len(rows),
        ),
        warnings=warnings,
        session_id=session_id,
        manual_review_available=True,
    )


@router.post("/ocr/manual-review")
async def request_manual_ocr_review(
    payload: OcrManualReviewRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    debug_root = Path(__file__).resolve().parents[1] / "data" / "ocr_debug"
    session_id = Path(payload.session_id or "").name
    session_dir = (debug_root / session_id).resolve()

    if not session_id or not session_dir.exists() or not session_dir.is_dir():
        raise HTTPException(status_code=404, detail="Sessão OCR não encontrada para revisão manual.")

    if not str(session_dir).startswith(str(debug_root.resolve())):
        raise HTTPException(status_code=400, detail="Sessão OCR inválida.")

    note = (payload.note or "").strip()
    request_payload = {
        "requested_at": datetime.utcnow().isoformat(),
        "session_id": session_id,
        "user_id": current_user.id,
        "user_email": current_user.email,
        "note": note,
        "status": "pending",
    }
    (session_dir / "manual_review_request.json").write_text(
        json.dumps(request_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {"ok": True, "detail": "Solicitação de revisão manual enviada.", "session_id": session_id}


@router.get("/player-prices/me")
async def list_player_prices(current_user: User = Depends(get_current_user)):
    return {"items": get_account_player_prices(current_user.id)}


@router.put("/player-prices")
async def update_player_price(
    payload: SavePlayerPricePayload,
    current_user: User = Depends(get_current_user),
):
    save_account_player_price(
        account_id=current_user.id,
        item_name=payload.item_name,
        player_unit_price=payload.player_unit_price,
    )
    return {"ok": True}


# ---------- Hunt Sessions -------------------------------------------------------

@router.post("/sessions", response_model=HuntSessionListItem, status_code=201)
async def save_hunt_session(
    payload: HuntSessionSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HuntSessionListItem:
    total_npc = sum(float(d.get("npcTotalPrice", 0)) for d in payload.drops)
    total_player = sum(float(d.get("playerTotalPrice", 0)) for d in payload.drops)
    total_enemies = sum(int(e.quantity) for e in payload.enemies)

    session = HuntSession(
        user_id=current_user.id,
        character_id=payload.character_id,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        hunt_date=payload.hunt_date or datetime.utcnow(),
        drops_json=[d for d in payload.drops],
        enemies_json=[e.model_dump() for e in payload.enemies],
        consumables_json=[c.model_dump() for c in payload.consumables],
        total_npc_value=total_npc,
        total_player_value=total_player,
        total_enemies=total_enemies,
        total_consumables_cost=sum(
            float(c.preco_npc) * int(c.quantity) for c in payload.consumables
        ),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return HuntSessionListItem.model_validate(session)


@router.get("/sessions", response_model=list[HuntSessionListItem])
async def list_hunt_sessions(
    character_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HuntSessionListItem]:
    query = db.query(HuntSession).filter(HuntSession.user_id == current_user.id)
    if character_id is not None:
        query = query.filter(HuntSession.character_id == character_id)
    sessions = (
        query.order_by(HuntSession.hunt_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [HuntSessionListItem.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=HuntSessionDetail)
async def get_hunt_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HuntSessionDetail:
    session = db.query(HuntSession).filter(
        HuntSession.id == session_id,
        HuntSession.user_id == current_user.id,
    ).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    return HuntSessionDetail.model_validate(session)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_hunt_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    session = db.query(HuntSession).filter(
        HuntSession.id == session_id,
        HuntSession.user_id == current_user.id,
    ).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    db.delete(session)
    db.commit()


@router.get("/enemies")
async def list_enemies(
    _current_user: User = Depends(get_current_user),
) -> list[str]:
    from pathlib import Path
    import json
    path = Path(__file__).resolve().parents[1] / "data" / "inimigos.json"
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    # Support both plain string array and {"nome": "..."} object array
    if raw and isinstance(raw[0], dict):
        return [entry["nome"] for entry in raw if entry.get("nome")]
    return raw


@router.get("/consumables")
async def list_consumables(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    import json
    path = Path(__file__).resolve().parents[1] / "data" / "itens_consumivel.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))
