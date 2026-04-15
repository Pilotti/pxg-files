from __future__ import annotations

import json
from pathlib import Path
import unicodedata

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.catalog import ConsumableCatalogItem


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "itens_consumivel.json"


def normalize_consumable_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(normalized.lower().split())


def normalize_consumable_category(category: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", category or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(normalized.lower().split())


def _clean_category(category: str | None) -> str:
    return " ".join(str(category or "").strip().split())


def _require_db(db: Session | None) -> Session:
    if db is None:
        raise RuntimeError("db e obrigatorio quando CATALOG_STORAGE=database")
    return db


def _to_response(item: ConsumableCatalogItem) -> dict:
    return {
        "nome": item.nome,
        "preco_npc": float(item.preco_npc or 0),
        "categoria": item.categoria or "",
    }


def _normalize_entry(entry: object) -> dict | None:
    if isinstance(entry, str):
        name = entry.strip()
        return {"nome": name, "preco_npc": 0.0, "categoria": ""} if name else None

    if not isinstance(entry, dict):
        return None

    name = str(entry.get("nome") or entry.get("name") or "").strip()
    if not name:
        return None

    try:
        price = float(entry.get("preco_npc", 0) or 0)
    except Exception:
        price = 0.0

    category = _clean_category(entry.get("categoria") or entry.get("category"))
    return {
        "nome": name,
        "preco_npc": price,
        "categoria": category,
    }


def _read_store() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8") or "[]")
        if not isinstance(raw, list):
            return []
        items: list[dict] = []
        for entry in raw:
            normalized = _normalize_entry(entry)
            if normalized is not None:
                items.append(normalized)
        return items
    except Exception:
        return []


def _write_store(items: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=4), encoding="utf-8")


def list_consumables(search: str | None = None, category: str | None = None, db: Session | None = None) -> list[dict]:
    if settings.use_database_catalog:
        session = _require_db(db)
        query = session.query(ConsumableCatalogItem)

        if search:
            needle = normalize_consumable_name(search)
            query = query.filter(ConsumableCatalogItem.normalized_name.contains(needle))

        if category:
            normalized_category = normalize_consumable_category(category)
            if normalized_category == "sem categoria":
                query = query.filter(ConsumableCatalogItem.normalized_category == "")
            else:
                query = query.filter(ConsumableCatalogItem.normalized_category == normalized_category)

        return [
            _to_response(item)
            for item in query.order_by(
                ConsumableCatalogItem.normalized_category.asc(),
                ConsumableCatalogItem.normalized_name.asc(),
            ).all()
        ]

    items = _read_store()
    if search:
        needle = normalize_consumable_name(search)
        items = [item for item in items if needle in normalize_consumable_name(item.get("nome", ""))]

    if category:
        normalized_category = normalize_consumable_category(category)
        if normalized_category == "sem categoria":
            items = [item for item in items if not normalize_consumable_category(item.get("categoria"))]
        else:
            items = [
                item
                for item in items
                if normalize_consumable_category(item.get("categoria")) == normalized_category
            ]

    return sorted(
        items,
        key=lambda item: (
            normalize_consumable_category(item.get("categoria")),
            item.get("nome", "").lower(),
        ),
    )


def list_consumable_categories(db: Session | None = None) -> list[str]:
    if settings.use_database_catalog:
        session = _require_db(db)
        categories = {
            _clean_category(item.categoria)
            for item in session.query(ConsumableCatalogItem.categoria).all()
            if _clean_category(item.categoria)
        }
        return sorted(categories, key=lambda item: normalize_consumable_category(item))

    categories = {
        _clean_category(item.get("categoria"))
        for item in _read_store()
        if _clean_category(item.get("categoria"))
    }
    return sorted(categories, key=lambda item: normalize_consumable_category(item))


def has_consumable(name: str, db: Session | None = None) -> bool:
    norm = normalize_consumable_name(name)
    if settings.use_database_catalog:
        if not norm:
            return False
        session = _require_db(db)
        return session.query(ConsumableCatalogItem.id).filter(
            ConsumableCatalogItem.normalized_name == norm
        ).first() is not None

    return any(normalize_consumable_name(item.get("nome", "")) == norm for item in _read_store())


def create_consumable(name: str, preco_npc: float, categoria: str | None = None, db: Session | None = None) -> dict:
    norm = normalize_consumable_name(name)
    if not norm:
        raise ValueError("Nome invalido para consumivel")

    if settings.use_database_catalog:
        session = _require_db(db)
        if has_consumable(name, db=session):
            raise ValueError(f"Consumivel '{name}' ja existe")
        item = ConsumableCatalogItem(
            nome=name.strip(),
            normalized_name=norm,
            preco_npc=float(preco_npc),
            categoria=_clean_category(categoria),
            normalized_category=normalize_consumable_category(categoria),
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        return _to_response(item)

    items = _read_store()
    if any(normalize_consumable_name(item.get("nome", "")) == norm for item in items):
        raise ValueError(f"Consumivel '{name}' ja existe")

    entry = {
        "nome": name.strip(),
        "preco_npc": float(preco_npc),
        "categoria": _clean_category(categoria),
    }
    items.append(entry)
    _write_store(items)
    return entry


def update_consumable(
    previous_name: str,
    new_name: str,
    preco_npc: float,
    categoria: str | None = None,
    db: Session | None = None,
) -> dict:
    prev_norm = normalize_consumable_name(previous_name)
    new_norm = normalize_consumable_name(new_name)

    if not new_norm:
        raise ValueError("Nome invalido para consumivel")

    if settings.use_database_catalog:
        session = _require_db(db)
        item = session.query(ConsumableCatalogItem).filter(
            ConsumableCatalogItem.normalized_name == prev_norm
        ).first()
        if item is None:
            raise ValueError(f"Consumivel '{previous_name}' nao encontrado")
        if prev_norm != new_norm and has_consumable(new_name, db=session):
            raise ValueError(f"Consumivel '{new_name}' ja existe")

        item.nome = new_name.strip()
        item.normalized_name = new_norm
        item.preco_npc = float(preco_npc)
        item.categoria = _clean_category(categoria)
        item.normalized_category = normalize_consumable_category(categoria)
        session.commit()
        session.refresh(item)
        return _to_response(item)

    items = _read_store()
    target_index = next(
        (i for i, item in enumerate(items) if normalize_consumable_name(item.get("nome", "")) == prev_norm),
        None,
    )
    if target_index is None:
        raise ValueError(f"Consumivel '{previous_name}' nao encontrado")

    if prev_norm != new_norm:
        conflict = any(
            normalize_consumable_name(item.get("nome", "")) == new_norm
            for i, item in enumerate(items)
            if i != target_index
        )
        if conflict:
            raise ValueError(f"Consumivel '{new_name}' ja existe")

    items[target_index] = {
        "nome": new_name.strip(),
        "preco_npc": float(preco_npc),
        "categoria": _clean_category(categoria),
    }
    _write_store(items)
    return items[target_index]


def delete_consumable(name: str, db: Session | None = None) -> None:
    norm = normalize_consumable_name(name)

    if settings.use_database_catalog:
        session = _require_db(db)
        item = session.query(ConsumableCatalogItem).filter(
            ConsumableCatalogItem.normalized_name == norm
        ).first()
        if item is None:
            raise ValueError(f"Consumivel '{name}' nao encontrado")
        session.delete(item)
        session.commit()
        return

    items = _read_store()
    new_items = [item for item in items if normalize_consumable_name(item.get("nome", "")) != norm]
    if len(new_items) == len(items):
        raise ValueError(f"Consumivel '{name}' nao encontrado")
    _write_store(new_items)
