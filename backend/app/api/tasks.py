from datetime import datetime

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.character import Character
from app.models.tasks import CharacterTask, TaskTemplate
from app.models.user import User
from app.schemas.tasks import ActionResponse, CharacterTaskItem, TaskCatalogResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])


def normalize_task_types(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(i).strip() for i in parsed if str(i).strip()]
            return [str(parsed).strip()] if str(parsed).strip() else []
        except (json.JSONDecodeError, ValueError):
            return [text]
    return [str(value).strip()] if str(value).strip() else []


def normalize_continent_value(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized == "nightmare":
        return "nightmare_world"
    return normalized


def get_owned_character(db: Session, current_user: User, character_id: int) -> Character:
    character = (
        db.query(Character)
        .filter(
            Character.id == character_id,
            Character.user_id == current_user.id,
        )
        .first()
    )

    if not character:
        raise HTTPException(status_code=404, detail="Personagem não encontrado")

    return character


@router.get("/catalog", response_model=list[TaskCatalogResponse])
def get_task_catalog(
    character_id: int = Query(...),
    task_type: str | None = Query(None),
    continent: str | None = Query(None),
    city: str | None = Query(None),
    nw_level: int | None = Query(None, ge=1, le=999),
    min_level: int | None = Query(None, ge=0, le=625),
    max_level: int | None = Query(None, ge=0, le=625),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    query = db.query(TaskTemplate).filter(TaskTemplate.is_active.is_(True))

    if task_type:
        query = query.filter(
            cast(TaskTemplate.task_type, String).contains(f'"{task_type}"')
        )

    normalized_continent = normalize_continent_value(continent)
    if normalized_continent:
        query = query.filter(TaskTemplate.continent == normalized_continent)

    if city:
        query = query.filter(TaskTemplate.city.ilike(city.strip()))

    if nw_level is not None:
        query = query.filter(TaskTemplate.nw_level == nw_level)

    if min_level is not None:
        query = query.filter(TaskTemplate.min_level >= min_level)

    if max_level is not None:
        query = query.filter(TaskTemplate.min_level <= max_level)

    templates = query.order_by(
        TaskTemplate.min_level.asc(),
        TaskTemplate.name.asc(),
    ).all()

    character_links = (
        db.query(CharacterTask)
        .filter(CharacterTask.character_id == character_id)
        .all()
    )

    status_by_template_id: dict[int, str] = {}
    for link in character_links:
        status_by_template_id[link.task_template_id] = (
            "completed" if link.is_completed else "active"
        )

    result: list[TaskCatalogResponse] = []

    for template in templates:
        result.append(
            TaskCatalogResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                task_type=normalize_task_types(template.task_type),
                continent=template.continent,
                min_level=template.min_level,
                nw_level=template.nw_level,
                reward_text=template.reward_text,
                npc_name=template.npc_name,
                coordinate=template.coordinate,
                city=template.city,
                is_active=template.is_active,
                status=status_by_template_id.get(template.id, "available"),
            )
        )

    return result


@router.get("", response_model=list[CharacterTaskItem])
def list_character_tasks(
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    items = (
        db.query(CharacterTask)
        .options(joinedload(CharacterTask.task_template))
        .filter(CharacterTask.character_id == character_id)
        .order_by(CharacterTask.is_completed.asc(), CharacterTask.activated_at.asc())
        .all()
    )

    return [
        CharacterTaskItem(
            id=item.id,
            template_id=item.task_template.id,
            name=item.task_template.name,
            description=item.task_template.description,
            task_type=normalize_task_types(item.task_template.task_type),
            continent=item.task_template.continent,
            min_level=item.task_template.min_level,
            nw_level=item.task_template.nw_level,
            reward_text=item.task_template.reward_text,
            npc_name=item.task_template.npc_name,
            coordinate=item.task_template.coordinate,
            city=item.task_template.city,
            is_completed=item.is_completed,
            activated_at=item.activated_at,
            completed_at=item.completed_at,
        )
        for item in items
    ]


@router.post("/{task_template_id}/activate", response_model=ActionResponse)
def activate_task(
    task_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    template = (
        db.query(TaskTemplate)
        .filter(
            TaskTemplate.id == task_template_id,
            TaskTemplate.is_active.is_(True),
        )
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Task não encontrada")

    existing = (
        db.query(CharacterTask)
        .filter(
            CharacterTask.character_id == character_id,
            CharacterTask.task_template_id == task_template_id,
        )
        .first()
    )

    if existing:
        if existing.is_completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Essa task já foi concluída por este personagem",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa task já está ativa para este personagem",
        )

    link = CharacterTask(
        character_id=character_id,
        task_template_id=task_template_id,
        is_completed=False,
    )

    db.add(link)
    db.commit()

    return ActionResponse(detail="Task ativada com sucesso")


@router.patch("/{task_template_id}/complete", response_model=ActionResponse)
def complete_task(
    task_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterTask)
        .filter(
            CharacterTask.character_id == character_id,
            CharacterTask.task_template_id == task_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa task não está ativa para este personagem",
        )

    if link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa task já foi concluída",
        )

    link.is_completed = True
    link.completed_at = datetime.utcnow()

    db.commit()

    return ActionResponse(detail="Task concluída com sucesso")


@router.patch("/{task_template_id}/uncomplete", response_model=ActionResponse)
def uncomplete_task(
    task_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterTask)
        .filter(
            CharacterTask.character_id == character_id,
            CharacterTask.task_template_id == task_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa task não está ativa para este personagem",
        )

    if not link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa task já está pendente",
        )

    link.is_completed = False
    link.completed_at = None

    db.commit()

    return ActionResponse(detail="Task marcada como pendente novamente")


@router.delete("/{task_template_id}", response_model=ActionResponse)
def deactivate_task(
    task_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterTask)
        .filter(
            CharacterTask.character_id == character_id,
            CharacterTask.task_template_id == task_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa task não está ativa para este personagem",
        )

    if link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasks concluídas não podem ser removidas",
        )

    db.delete(link)
    db.commit()

    return ActionResponse(detail="Task desativada com sucesso")