from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
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
)
from app.services.ocr_debug_settings import is_ocr_debug_enabled
from app.services.hunts_prices import (
    get_account_player_prices,
    save_account_player_price,
)

router = APIRouter(prefix="/hunts", tags=["hunts"])


class SavePlayerPricePayload(BaseModel):
    item_name: str
    player_unit_price: float


@router.post("/ocr/drops", response_model=HuntDropsOcrResponse)
async def process_drops_ocr(
    character_id: int | None = Form(default=None),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HuntDropsOcrResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Nenhuma imagem enviada.")

    recognized_lines = []
    warnings: list[str] = []
    debug_root: Path | None = None

    debug_ocr = is_ocr_debug_enabled()

    if debug_ocr:
        debug_root = Path(__file__).resolve().parents[1] / "data" / "ocr_debug"
        session_dir = debug_root / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}"
        session_dir.mkdir(parents=True, exist_ok=True)
    else:
        session_dir = None

    for index, upload in enumerate(files, start=1):
        if not upload.content_type or not upload.content_type.startswith("image/"):
            warnings.append(f"Arquivo ignorado: {upload.filename}")
            continue

        content = await upload.read()
        debug_notes: list[str] = []
        image_debug_dir = None
        if session_dir is not None:
            image_name = (upload.filename or f"imagem_{index}").replace(" ", "_")
            image_name = "".join(char for char in image_name if char.isalnum() or char in {"_", ".", "-"})
            image_debug_dir = session_dir / f"{index:02d}_{image_name}"

        try:
            recognized_lines.extend(
                extract_drop_lines_from_image(content, debug_dir=image_debug_dir, debug_notes=debug_notes)
            )
        except Exception as exc:
            warnings.append(f"Falha ao processar {upload.filename}: {exc}")

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

    return HuntDropsOcrResponse(
        rows=rows,
        summary=HuntDropSummary(
            processed_images=len(files),
            recognized_lines=len(recognized_lines),
            duplicates_ignored=duplicates_ignored,
            final_rows=len(rows),
        ),
        warnings=[],
    )


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
