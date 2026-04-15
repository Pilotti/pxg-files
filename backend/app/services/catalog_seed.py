from __future__ import annotations

import json
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.catalog import ConsumableCatalogItem, HuntNpcPrice, PokemonEntry
from app.services.consumables import (
    normalize_consumable_category,
    normalize_consumable_name,
)
from app.services.hunt_npc_prices import normalize_item_name


SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed_data"
_POKEMON_RE = re.compile(r"^(\d{4}) - (.+)$")


def _read_json(path: Path, fallback):
    try:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8") or json.dumps(fallback))
    except Exception:
        return fallback


def _parse_pokemon_name(full_name: str) -> tuple[str, str]:
    match = _POKEMON_RE.match(full_name)
    if match:
        return match.group(1), match.group(2)
    return "", full_name


def seed_database_catalogs_if_empty(db: Session) -> dict[str, int]:
    seeded = {
        "pokemon": 0,
        "hunt_npc_prices": 0,
        "consumables": 0,
    }

    if db.query(PokemonEntry.id).first() is None:
        raw_pokemon = _read_json(SEED_DATA_DIR / "inimigos.json", [])
        for entry in raw_pokemon if isinstance(raw_pokemon, list) else []:
            full_name = str(entry.get("nome") if isinstance(entry, dict) else entry or "").strip()
            if not full_name:
                continue
            dex_id, name = _parse_pokemon_name(full_name)
            db.add(PokemonEntry(full_name=full_name, dex_id=dex_id, name=name))
            seeded["pokemon"] += 1

    if db.query(HuntNpcPrice.id).first() is None:
        raw_prices = _read_json(SEED_DATA_DIR / "hunts_npc_prices.json", {})
        if isinstance(raw_prices, dict):
            for name, value in raw_prices.items():
                normalized_name = normalize_item_name(str(name))
                if not normalized_name:
                    continue
                try:
                    unit_price = float(value or 0)
                except Exception:
                    unit_price = 0.0
                db.add(HuntNpcPrice(name=normalized_name, normalized_name=normalized_name, unit_price=unit_price))
                seeded["hunt_npc_prices"] += 1

    if db.query(ConsumableCatalogItem.id).first() is None:
        raw_consumables = _read_json(SEED_DATA_DIR / "itens_consumivel.json", [])
        for entry in raw_consumables if isinstance(raw_consumables, list) else []:
            if isinstance(entry, str):
                nome = entry.strip()
                preco_npc = 0.0
                categoria = ""
            elif isinstance(entry, dict):
                nome = str(entry.get("nome") or entry.get("name") or "").strip()
                try:
                    preco_npc = float(entry.get("preco_npc", 0) or 0)
                except Exception:
                    preco_npc = 0.0
                categoria = " ".join(str(entry.get("categoria") or entry.get("category") or "").split())
            else:
                continue

            normalized_name = normalize_consumable_name(nome)
            if not normalized_name:
                continue

            db.add(
                ConsumableCatalogItem(
                    nome=nome,
                    normalized_name=normalized_name,
                    preco_npc=preco_npc,
                    categoria=categoria,
                    normalized_category=normalize_consumable_category(categoria),
                )
            )
            seeded["consumables"] += 1

    if any(seeded.values()):
        db.commit()

    return seeded
