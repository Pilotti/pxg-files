from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_enabled_menu
from app.db.session import get_db
from app.models.character import Character
from app.models.tasks import CharacterQuest, QuestTemplate
from app.models.user import User
from app.schemas.tasks import ActionResponse, CharacterQuestItem, QuestCatalogResponse

router = APIRouter(
    prefix="/quests",
    tags=["quests"],
    dependencies=[Depends(require_enabled_menu("quests"))],
)


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


@router.get("/catalog", response_model=list[QuestCatalogResponse])
def get_quest_catalog(
    character_id: int = Query(...),
    continent: str | None = Query(None),
    city: str | None = Query(None),
    nw_level: int | None = Query(None, ge=1, le=999),
    min_level: int | None = Query(None, ge=0, le=625),
    max_level: int | None = Query(None, ge=0, le=625),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    query = db.query(QuestTemplate).filter(QuestTemplate.is_active.is_(True))

    normalized_continent = normalize_continent_value(continent)
    if normalized_continent:
        query = query.filter(QuestTemplate.continent == normalized_continent)

    if city:
        query = query.filter(QuestTemplate.city.ilike(city.strip()))

    if nw_level is not None:
        query = query.filter(QuestTemplate.nw_level == nw_level)

    if min_level is not None:
        query = query.filter(QuestTemplate.min_level >= min_level)

    if max_level is not None:
        query = query.filter(QuestTemplate.min_level <= max_level)

    templates = query.order_by(
        QuestTemplate.min_level.asc(),
        QuestTemplate.name.asc(),
    ).all()

    character_links = (
        db.query(CharacterQuest)
        .filter(CharacterQuest.character_id == character_id)
        .all()
    )

    status_by_template_id: dict[int, str] = {}
    for link in character_links:
        status_by_template_id[link.quest_template_id] = (
            "completed" if link.is_completed else "active"
        )

    result: list[QuestCatalogResponse] = []

    for template in templates:
        result.append(
            QuestCatalogResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                continent=template.continent,
                city=template.city,
                min_level=template.min_level,
                nw_level=template.nw_level,
                reward_text=template.reward_text,
                is_active=template.is_active,
                status=status_by_template_id.get(template.id, "available"),
            )
        )

    return result


@router.get("", response_model=list[CharacterQuestItem])
def list_character_quests(
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    items = (
        db.query(CharacterQuest)
        .options(joinedload(CharacterQuest.quest_template))
        .filter(CharacterQuest.character_id == character_id)
        .order_by(CharacterQuest.is_completed.asc(), CharacterQuest.activated_at.asc())
        .all()
    )

    return [
        CharacterQuestItem(
            id=item.id,
            template_id=item.quest_template.id,
            name=item.quest_template.name,
            description=item.quest_template.description,
            continent=item.quest_template.continent,
            city=item.quest_template.city,
            min_level=item.quest_template.min_level,
            nw_level=item.quest_template.nw_level,
            reward_text=item.quest_template.reward_text,
            is_completed=item.is_completed,
            activated_at=item.activated_at,
            completed_at=item.completed_at,
        )
        for item in items
    ]


@router.post("/{quest_template_id}/activate", response_model=ActionResponse)
def activate_quest(
    quest_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    template = (
        db.query(QuestTemplate)
        .filter(
            QuestTemplate.id == quest_template_id,
            QuestTemplate.is_active.is_(True),
        )
        .first()
    )

    if not template:
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    existing = (
        db.query(CharacterQuest)
        .filter(
            CharacterQuest.character_id == character_id,
            CharacterQuest.quest_template_id == quest_template_id,
        )
        .first()
    )

    if existing:
        if existing.is_completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Essa quest já foi concluída por este personagem",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa quest já está ativa para este personagem",
        )

    link = CharacterQuest(
        character_id=character_id,
        quest_template_id=quest_template_id,
        is_completed=False,
    )

    db.add(link)
    db.commit()

    return ActionResponse(detail="Quest ativada com sucesso")


@router.patch("/{quest_template_id}/complete", response_model=ActionResponse)
def complete_quest(
    quest_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterQuest)
        .filter(
            CharacterQuest.character_id == character_id,
            CharacterQuest.quest_template_id == quest_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa quest não está ativa para este personagem",
        )

    if link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa quest já foi concluída",
        )

    link.is_completed = True
    link.completed_at = datetime.utcnow()

    db.commit()

    return ActionResponse(detail="Quest concluída com sucesso")


@router.patch("/{quest_template_id}/uncomplete", response_model=ActionResponse)
def uncomplete_quest(
    quest_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterQuest)
        .filter(
            CharacterQuest.character_id == character_id,
            CharacterQuest.quest_template_id == quest_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa quest não está ativa para este personagem",
        )

    if not link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa quest já está pendente",
        )

    link.is_completed = False
    link.completed_at = None

    db.commit()

    return ActionResponse(detail="Quest marcada como pendente novamente")


@router.delete("/{quest_template_id}", response_model=ActionResponse)
def deactivate_quest(
    quest_template_id: int,
    character_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_character(db, current_user, character_id)

    link = (
        db.query(CharacterQuest)
        .filter(
            CharacterQuest.character_id == character_id,
            CharacterQuest.quest_template_id == quest_template_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Essa quest não está ativa para este personagem",
        )

    if link.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quests concluídas não podem ser removidas",
        )

    db.delete(link)
    db.commit()

    return ActionResponse(detail="Quest desativada com sucesso")