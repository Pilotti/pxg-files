from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.tasks import CharacterTask, TaskTemplate
from app.schemas.admin import AdminTaskCreateRequest


TASK_JSON_DIR = Path(__file__).resolve().parents[1] / "data" / "tasks"
TASK_SEED_JSON_DIR = Path(__file__).resolve().parents[1] / "seed_data" / "tasks"
CONTINENT_FILE_NAMES = {
    "kanto": "kanto.json",
    "johto": "johto.json",
    "orange_islands": "orange_islands.json",
    "outland": "outland.json",
    "nightmare_world": "nightmare_world.json",
    "orre": "orre.json",
}


def _normalize_task_types(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if value is None:
        return []

    text = str(value).strip()
    if not text:
        return []

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except (json.JSONDecodeError, ValueError):
            pass

    return [text]


def ensure_task_json_files(json_dir: Path = TASK_JSON_DIR) -> None:
    json_dir.mkdir(parents=True, exist_ok=True)

    for file_name in CONTINENT_FILE_NAMES.values():
        file_path = json_dir / file_name
        if not file_path.exists():
            file_path.write_text("[]\n", encoding="utf-8")


def _task_identity(name: str, continent: str) -> tuple[str, str]:
    return (str(name or "").strip().lower(), str(continent or "").strip().lower())


def _serialize_task(task: TaskTemplate) -> dict:
    task_types = _normalize_task_types(task.task_type)
    return {
        "name": task.name,
        "description": task.description or "",
        "task_type": task_types,
        "continent": task.continent,
        "min_level": task.min_level,
        "nw_level": task.nw_level,
        "reward_text": task.reward_text or "",
        "coordinate": task.coordinate,
        "city": task.city or "",
        "is_active": task.is_active,
    }


def export_task_templates_to_json_files(db: Session) -> None:
    ensure_task_json_files()

    grouped_tasks: dict[str, list[dict]] = {continent: [] for continent in CONTINENT_FILE_NAMES}
    items = (
        db.query(TaskTemplate)
        .order_by(TaskTemplate.continent.asc(), TaskTemplate.min_level.asc(), TaskTemplate.name.asc())
        .all()
    )

    for item in items:
        grouped_tasks.setdefault(item.continent, []).append(_serialize_task(item))

    for continent, file_name in CONTINENT_FILE_NAMES.items():
        file_path = TASK_JSON_DIR / file_name
        file_path.write_text(
            json.dumps(grouped_tasks.get(continent, []), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def import_task_templates_from_json_files(
    db: Session,
    *,
    prune_missing: bool = False,
    json_dir: Path = TASK_JSON_DIR,
) -> int:
    ensure_task_json_files(json_dir)

    desired_payloads: dict[tuple[str, str], AdminTaskCreateRequest] = {}

    for continent, file_name in CONTINENT_FILE_NAMES.items():
        file_path = json_dir / file_name
        raw_content = file_path.read_text(encoding="utf-8").strip()
        entries = [] if not raw_content else json.loads(raw_content)

        if not isinstance(entries, list):
            raise ValueError(f"Arquivo de tasks invalido: {file_path.name}")

        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError(f"Cada task em {file_path.name} precisa ser um objeto JSON")

            normalized_entry = dict(entry)
            normalized_entry["continent"] = normalized_entry.get("continent") or continent
            model = AdminTaskCreateRequest.model_validate(normalized_entry)
            desired_payloads[_task_identity(model.name, model.continent)] = model

    existing_items = db.query(TaskTemplate).all()
    existing_by_key = {
        _task_identity(item.name, item.continent): item
        for item in existing_items
    }

    changed = 0

    for key, payload in desired_payloads.items():
        item = existing_by_key.get(key)
        if item is None:
            db.add(
                TaskTemplate(
                    name=payload.name,
                    description=payload.description,
                    task_type=payload.task_type,
                    continent=payload.continent,
                    min_level=payload.min_level,
                    nw_level=payload.nw_level,
                    reward_text=payload.reward_text,
                    npc_name=payload.name,
                    coordinate=payload.coordinate,
                    city=payload.city,
                    is_active=payload.is_active,
                )
            )
            changed += 1
            continue

        next_values = {
            "description": payload.description,
            "task_type": payload.task_type,
            "min_level": payload.min_level,
            "nw_level": payload.nw_level,
            "reward_text": payload.reward_text,
            "npc_name": payload.name,
            "coordinate": payload.coordinate,
            "city": payload.city,
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
            db.query(CharacterTask).filter(CharacterTask.task_template_id == item.id).delete(
                synchronize_session=False
            )
            db.delete(item)
            changed += 1

    if changed:
        db.commit()
        export_task_templates_to_json_files(db)

    return changed
