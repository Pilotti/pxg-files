from __future__ import annotations

import json
from pathlib import Path
import unicodedata


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "itens_consumivel.json"


def normalize_consumable_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(normalized.lower().split())


def _read_store() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8") or "[]")
        if not isinstance(raw, list):
            return []
        return raw
    except Exception:
        return []


def _write_store(items: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=4), encoding="utf-8")


def list_consumables(search: str | None = None) -> list[dict]:
    items = _read_store()
    if search:
        needle = normalize_consumable_name(search)
        items = [item for item in items if needle in normalize_consumable_name(item.get("nome", ""))]
    return sorted(items, key=lambda item: item.get("nome", "").lower())


def has_consumable(name: str) -> bool:
    norm = normalize_consumable_name(name)
    return any(normalize_consumable_name(item.get("nome", "")) == norm for item in _read_store())


def create_consumable(name: str, preco_npc: float) -> dict:
    norm = normalize_consumable_name(name)
    if not norm:
        raise ValueError("Nome inválido para consumível")

    items = _read_store()
    if any(normalize_consumable_name(item.get("nome", "")) == norm for item in items):
        raise ValueError(f"Consumível '{name}' já existe")

    entry = {"nome": name.strip(), "preco_npc": float(preco_npc)}
    items.append(entry)
    _write_store(items)
    return entry


def update_consumable(previous_name: str, new_name: str, preco_npc: float) -> dict:
    prev_norm = normalize_consumable_name(previous_name)
    new_norm = normalize_consumable_name(new_name)

    if not new_norm:
        raise ValueError("Nome inválido para consumível")

    items = _read_store()

    target_index = next(
        (i for i, item in enumerate(items) if normalize_consumable_name(item.get("nome", "")) == prev_norm),
        None,
    )
    if target_index is None:
        raise ValueError(f"Consumível '{previous_name}' não encontrado")

    if prev_norm != new_norm:
        conflict = any(
            normalize_consumable_name(item.get("nome", "")) == new_norm
            for i, item in enumerate(items)
            if i != target_index
        )
        if conflict:
            raise ValueError(f"Consumível '{new_name}' já existe")

    items[target_index] = {"nome": new_name.strip(), "preco_npc": float(preco_npc)}
    _write_store(items)
    return items[target_index]


def delete_consumable(name: str) -> None:
    norm = normalize_consumable_name(name)
    items = _read_store()
    new_items = [item for item in items if normalize_consumable_name(item.get("nome", "")) != norm]
    if len(new_items) == len(items):
        raise ValueError(f"Consumível '{name}' não encontrado")
    _write_store(new_items)
