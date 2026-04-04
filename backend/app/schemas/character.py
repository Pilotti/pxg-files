from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CharacterBase(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    cla: str = Field(min_length=1, max_length=100)
    nivel: int = Field(ge=1, le=10000)


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(CharacterBase):
    pass


class CharacterResponse(CharacterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_favorite: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CharacterDeleteResponse(BaseModel):
    detail: str
    deleted_character_id: int
    promoted_favorite_id: int | None = None
    remaining_count: int