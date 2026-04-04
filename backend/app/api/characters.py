from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.character import Character
from app.models.user import User
from app.schemas.character import (
    CharacterCreate,
    CharacterDeleteResponse,
    CharacterResponse,
    CharacterUpdate,
)

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=list[CharacterResponse])
def list_characters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    characters = (
        db.query(Character)
        .filter(Character.user_id == current_user.id)
        .order_by(Character.is_favorite.desc(), Character.nome.asc())
        .all()
    )

    return characters


@router.post(
    "",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_character(
    data: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    has_any_character = (
        db.query(Character)
        .filter(Character.user_id == current_user.id)
        .first()
    )

    character = Character(
        user_id=current_user.id,
        nome=data.nome.strip(),
        cla=data.cla.strip(),
        nivel=data.nivel,
        is_favorite=False if has_any_character else True,
    )

    if character.is_favorite:
        (
            db.query(Character)
            .filter(Character.user_id == current_user.id)
            .update({Character.is_favorite: False}, synchronize_session=False)
        )

    db.add(character)
    db.commit()
    db.refresh(character)

    return character


@router.put("/{character_id}", response_model=CharacterResponse)
def update_character(
    character_id: int,
    data: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    character.nome = data.nome.strip()
    character.cla = data.cla.strip()
    character.nivel = data.nivel

    db.commit()
    db.refresh(character)

    return character


@router.patch("/{character_id}/favorite", response_model=CharacterResponse)
def set_favorite_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    (
        db.query(Character)
        .filter(Character.user_id == current_user.id)
        .update({Character.is_favorite: False}, synchronize_session=False)
    )

    character.is_favorite = True

    db.commit()
    db.refresh(character)

    return character


@router.delete("/{character_id}", response_model=CharacterDeleteResponse)
def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    deleted_character_id = character.id
    deleted_was_favorite = character.is_favorite

    db.delete(character)
    db.commit()

    promoted_favorite_id = None

    if deleted_was_favorite:
        next_character = (
            db.query(Character)
            .filter(Character.user_id == current_user.id)
            .order_by(Character.nome.asc())
            .first()
        )

        if next_character:
            (
                db.query(Character)
                .filter(Character.user_id == current_user.id)
                .update({Character.is_favorite: False}, synchronize_session=False)
            )
            next_character.is_favorite = True
            db.commit()
            db.refresh(next_character)
            promoted_favorite_id = next_character.id

    remaining_characters = (
        db.query(Character)
        .filter(Character.user_id == current_user.id)
        .order_by(Character.is_favorite.desc(), Character.nome.asc())
        .all()
    )

    return CharacterDeleteResponse(
        detail="Personagem removido com sucesso",
        deleted_character_id=deleted_character_id,
        promoted_favorite_id=promoted_favorite_id,
        remaining_count=len(remaining_characters),
    )