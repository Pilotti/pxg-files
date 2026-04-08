from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.tasks import CharacterQuest, QuestTemplate
from app.schemas.admin import AdminQuestCreateRequest


QUEST_JSON_DIR = Path(__file__).resolve().parents[1] / "data" / "quests"
CONTINENT_FILE_NAMES = {
    "kanto": "kanto.json",
    "johto": "johto.json",
    "orange_islands": "orange_islands.json",
    "outland": "outland.json",
    "nightmare_world": "nightmare_world.json",
    "orre": "orre.json",
}


def ensure_quest_json_files() -> None:
    QUEST_JSON_DIR.mkdir(parents=True, exist_ok=True)

    for file_name in CONTINENT_FILE_NAMES.values():
        file_path = QUEST_JSON_DIR / file_name
        if not file_path.exists():
            file_path.write_text("[]\n", encoding="utf-8")


def _quest_identity(name: str, continent: str) -> tuple[str, str]:
    return (str(name or "").strip().lower(), str(continent or "").strip().lower())


def _serialize_quest(quest: QuestTemplate) -> dict:
    return {
        "name": quest.name,
        "description": quest.description or "",
        "continent": quest.continent,
        "city": quest.city or "",
        "min_level": quest.min_level,
        "nw_level": quest.nw_level,
        "reward_text": quest.reward_text or "",
        "is_active": quest.is_active,
    }


def export_quest_templates_to_json_files(db: Session) -> None:
    ensure_quest_json_files()

    grouped_quests: dict[str, list[dict]] = {continent: [] for continent in CONTINENT_FILE_NAMES}
    items = (
        db.query(QuestTemplate)
        .order_by(QuestTemplate.continent.asc(), QuestTemplate.min_level.asc(), QuestTemplate.name.asc())
        .all()
    )

    for item in items:
        grouped_quests.setdefault(item.continent, []).append(_serialize_quest(item))

    for continent, file_name in CONTINENT_FILE_NAMES.items():
        file_path = QUEST_JSON_DIR / file_name
        file_path.write_text(
            json.dumps(grouped_quests.get(continent, []), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def import_quest_templates_from_json_files(db: Session, *, prune_missing: bool = False) -> int:
    ensure_quest_json_files()

    desired_payloads: dict[tuple[str, str], AdminQuestCreateRequest] = {}

    for continent, file_name in CONTINENT_FILE_NAMES.items():
        file_path = QUEST_JSON_DIR / file_name
        raw_content = file_path.read_text(encoding="utf-8").strip()
        entries = [] if not raw_content else json.loads(raw_content)

        if not isinstance(entries, list):
            raise ValueError(f"Arquivo de quests invalido: {file_path.name}")

        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError(f"Cada quest em {file_path.name} precisa ser um objeto JSON")

            normalized_entry = dict(entry)
            normalized_entry["continent"] = normalized_entry.get("continent") or continent
            model = AdminQuestCreateRequest.model_validate(normalized_entry)
            desired_payloads[_quest_identity(model.name, model.continent)] = model

    existing_items = db.query(QuestTemplate).all()
    existing_by_key = {
        _quest_identity(item.name, item.continent): item
        for item in existing_items
    }

    changed = 0

    for key, payload in desired_payloads.items():
        item = existing_by_key.get(key)
        if item is None:
            db.add(
                QuestTemplate(
                    name=payload.name,
                    description=payload.description,
                    continent=payload.continent,
                    city=(payload.city or "").strip() or None,
                    min_level=payload.min_level,
                    nw_level=payload.nw_level,
                    reward_text=payload.reward_text,
                    is_active=payload.is_active,
                )
            )
            changed += 1
            continue

        next_values = {
            "description": payload.description,
            "city": (payload.city or "").strip() or None,
            "min_level": payload.min_level,
            "nw_level": payload.nw_level,
            "reward_text": payload.reward_text,
            "is_active": payload.is_active,
        }

        if any(getattr(item, field_name) != field_value for field_name, field_value in next_values.items()):
            for field_name, field_value in next_values.items():
                setattr(item, field_name, field_value)
            changed += 1

    if prune_missing:
        desired_keys = set(desired_payloads.keys())
        for key, item in existing_by_key.items():
            if key in desired_keys:
                continue
            db.query(CharacterQuest).filter(CharacterQuest.quest_template_id == item.id).delete(
                synchronize_session=False
            )
            db.delete(item)
            changed += 1

    if changed:
        db.commit()
        export_quest_templates_to_json_files(db)

    return changed
