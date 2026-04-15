from __future__ import annotations

import json
from pathlib import Path
import unicodedata

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.catalog import HuntNpcPrice


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "hunts_npc_prices.json"


def normalize_item_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = " ".join(normalized.lower().split())
    cleaned = []
    for char in normalized:
        if char.isalnum() or char == " ":
            cleaned.append(char)
    return " ".join("".join(cleaned).split())


def _require_db(db: Session | None) -> Session:
    if db is None:
        raise RuntimeError("db e obrigatorio quando CATALOG_STORAGE=database")
    return db


def _ensure_store() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text("{}", encoding="utf-8")


def _read_store() -> dict[str, float]:
    _ensure_store()
    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8") or "{}")
    except Exception:
        raw = {}

    return {
        normalize_item_name(item_name): float(value)
        for item_name, value in raw.items()
    }


def _read_database_store(db: Session) -> dict[str, float]:
    return {
        item.normalized_name: float(item.unit_price or 0)
        for item in db.query(HuntNpcPrice).all()
        if item.normalized_name
    }


def _get_store(db: Session | None = None) -> dict[str, float]:
    if settings.use_database_catalog:
        return _read_database_store(_require_db(db))
    return _read_store()


def get_known_item_display_map(db: Session | None = None) -> dict[str, str]:
    if settings.use_database_catalog:
        session = _require_db(db)
        return {
            item.normalized_name: item.name
            for item in session.query(HuntNpcPrice).all()
            if item.normalized_name and item.name
        }

    store = _read_store()
    return {name: name for name in store}


def get_npc_unit_price(item_name: str, db: Session | None = None) -> float:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return 0.0

    store = _get_store(db)
    return float(store.get(normalized_name, 0.0))


def get_npc_unit_price_from_ocr_context(
    item_name: str,
    quantity: float | int | None,
    ocr_total_price: float | int | None,
    db: Session | None = None,
) -> float:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return 0.0

    store = _get_store(db)

    if normalized_name in {"bee sting", "bec sting"}:
        candidate_prices = []
        if "bee sting" in store:
            candidate_prices.append(float(store["bee sting"]))
        if "bec sting" in store:
            candidate_prices.append(float(store["bec sting"]))

        inferred_unit: float | None = None
        try:
            quantity_value = float(quantity or 0)
            total_value = float(ocr_total_price or 0)
            if quantity_value > 0:
                inferred_unit = total_value / quantity_value
        except Exception:
            inferred_unit = None

        if candidate_prices and inferred_unit is not None:
            return min(candidate_prices, key=lambda candidate: abs(candidate - inferred_unit))

    return float(store.get(normalized_name, 0.0))


def has_npc_price_item(item_name: str, db: Session | None = None) -> bool:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return False

    if settings.use_database_catalog:
        session = _require_db(db)
        return session.query(HuntNpcPrice.id).filter(
            HuntNpcPrice.normalized_name == normalized_name
        ).first() is not None

    store = _read_store()
    return normalized_name in store


def list_npc_prices(search: str | None = None, db: Session | None = None) -> list[dict[str, float | str]]:
    if settings.use_database_catalog:
        session = _require_db(db)
        query = session.query(HuntNpcPrice)
        if search:
            needle = normalize_item_name(search)
            query = query.filter(HuntNpcPrice.normalized_name.contains(needle))
        return [
            {
                "name": item.name,
                "normalized_name": item.normalized_name,
                "unit_price": float(item.unit_price or 0),
            }
            for item in query.order_by(HuntNpcPrice.normalized_name.asc()).all()
        ]

    store = _read_store()
    items = [
        {"name": item_name, "normalized_name": item_name, "unit_price": float(value)}
        for item_name, value in store.items()
    ]

    if search:
        needle = normalize_item_name(search)
        items = [item for item in items if needle in str(item["normalized_name"])]

    items.sort(key=lambda item: str(item["name"]))
    return items


def update_npc_price(
    previous_name: str,
    new_name: str,
    unit_price: float,
    db: Session | None = None,
) -> dict[str, float | str]:
    previous_normalized = normalize_item_name(previous_name)
    new_normalized = normalize_item_name(new_name)
    if not new_normalized:
        raise ValueError("Nome invalido para preco NPC")

    if settings.use_database_catalog:
        session = _require_db(db)
        item = None
        if previous_normalized:
            item = session.query(HuntNpcPrice).filter(
                HuntNpcPrice.normalized_name == previous_normalized
            ).first()

        if item is None:
            item = session.query(HuntNpcPrice).filter(
                HuntNpcPrice.normalized_name == new_normalized
            ).first()

        if item is None:
            item = HuntNpcPrice(name=new_normalized, normalized_name=new_normalized, unit_price=float(unit_price))
            session.add(item)
        else:
            if previous_normalized != new_normalized and has_npc_price_item(new_name, db=session):
                raise ValueError(f"Item '{new_name}' ja existe na tabela de precos NPC.")
            item.name = new_normalized
            item.normalized_name = new_normalized
            item.unit_price = float(unit_price)

        session.flush()
        return {
            "name": item.name,
            "normalized_name": item.normalized_name,
            "unit_price": float(item.unit_price or 0),
        }

    store = _read_store()

    if previous_normalized and previous_normalized in store and previous_normalized != new_normalized:
        del store[previous_normalized]

    store[new_normalized] = float(unit_price)
    DATA_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "name": new_normalized,
        "normalized_name": new_normalized,
        "unit_price": float(unit_price),
    }
