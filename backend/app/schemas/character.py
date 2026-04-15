from datetime import datetime

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


TrimmedText100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class CharacterBase(BaseModel):
    nome: TrimmedText100
    cla: TrimmedText100
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
