from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.catalog import HuntPlayerPrice


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "hunts_player_prices.json"


def _ensure_store() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text("{}", encoding="utf-8")


def _normalize_item_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def _read_store() -> dict:
    _ensure_store()
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8") or "{}")
    except Exception:
        return {}


def _write_store(payload: dict) -> None:
    _ensure_store()
    DATA_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _require_db(db: Session | None) -> Session:
    if db is None:
        raise RuntimeError("db e obrigatorio quando CATALOG_STORAGE=database")
    return db


def get_account_player_prices(account_id: int | None, db: Session | None = None) -> Dict[str, float]:
    if account_id is None:
        return {}

    if settings.use_database_catalog:
        session = _require_db(db)
        return {
            item.normalized_name: float(item.player_unit_price or 0)
            for item in session.query(HuntPlayerPrice)
            .filter(HuntPlayerPrice.account_id == account_id)
            .all()
        }

    store = _read_store()
    key = str(account_id)
    raw_items = store.get(key, {})
    return {
        _normalize_item_name(item_name): float(value)
        for item_name, value in raw_items.items()
    }


def save_account_player_price(
    account_id: int,
    item_name: str,
    player_unit_price: float,
    db: Session | None = None,
) -> None:
    normalized_name = _normalize_item_name(item_name)
    if not normalized_name:
        return

    if settings.use_database_catalog:
        session = _require_db(db)
        item = (
            session.query(HuntPlayerPrice)
            .filter(
                HuntPlayerPrice.account_id == account_id,
                HuntPlayerPrice.normalized_name == normalized_name,
            )
            .first()
        )
        if item is None:
            item = HuntPlayerPrice(
                account_id=account_id,
                item_name=item_name.strip(),
                normalized_name=normalized_name,
                player_unit_price=float(player_unit_price),
            )
            session.add(item)
        else:
            item.item_name = item_name.strip()
            item.player_unit_price = float(player_unit_price)
        session.commit()
        return

    store = _read_store()
    key = str(account_id)

    if key not in store:
        store[key] = {}

    store[key][normalized_name] = float(player_unit_price)
    _write_store(store)
