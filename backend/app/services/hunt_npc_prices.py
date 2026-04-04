from __future__ import annotations

import json
from pathlib import Path
import unicodedata


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


def get_npc_unit_price(item_name: str) -> float:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return 0.0

    store = _read_store()
    return float(store.get(normalized_name, 0.0))


def get_npc_unit_price_from_ocr_context(
    item_name: str,
    quantity: float | int | None,
    ocr_total_price: float | int | None,
) -> float:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return 0.0

    store = _read_store()

    # Ambiguous OCR case: Bee Sting can be read as two close names with very different prices.
    # Use OCR total/quantity to infer which official NPC unit value is the best fit.
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


def has_npc_price_item(item_name: str) -> bool:
    normalized_name = normalize_item_name(item_name)
    if not normalized_name:
        return False

    store = _read_store()
    return normalized_name in store


def list_npc_prices(search: str | None = None) -> list[dict[str, float | str]]:
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


def update_npc_price(previous_name: str, new_name: str, unit_price: float) -> dict[str, float | str]:
    previous_normalized = normalize_item_name(previous_name)
    new_normalized = normalize_item_name(new_name)
    if not new_normalized:
        raise ValueError("Nome inválido para preço NPC")

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
