from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
import re

from app.schemas.tasks import Continent, TaskType


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminMeResponse(BaseModel):
    username: str
    role: str = "admin"


class AdminTaskCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    task_type: list[TaskType] = Field(min_length=1)
    continent: Continent
    min_level: int = Field(ge=5, le=625)
    nw_level: int | None = Field(default=None, ge=1, le=999)
    reward_text: str | None = None
    coordinate: str | None = Field(default=None, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    is_active: bool = True

    @field_validator("name", "city", mode="before")
    @classmethod
    def strip_required_text(cls, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("Campo obrigatório")
        return cleaned

    @field_validator("description", "reward_text", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("coordinate", mode="before")
    @classmethod
    def normalize_coordinate(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        cleaned = str(value).strip()
        if not re.fullmatch(r"-?\d{1,6}\s*,\s*-?\d{1,6}\s*,\s*-?\d{1,6}", cleaned):
            raise ValueError("Coordenada deve estar no formato x,y,z (números podem ser negativos)")
        return cleaned

    @field_validator("task_type", mode="before")
    @classmethod
    def normalize_task_type(cls, value):
        if isinstance(value, list):
            return value
        if value is None:
            return []
        text = str(value).strip()
        return [text] if text else []

    @field_validator("continent", mode="before")
    @classmethod
    def normalize_continent(cls, value):
        text = str(value or "").strip().lower()
        if text == "nightmare":
            return "nightmare_world"
        return text

    @model_validator(mode="after")
    def validate_nw_level(self):
        if self.continent == "nightmare_world":
            if self.nw_level is None:
                raise ValueError("NW Level é obrigatório para continente Nightmare World")
        else:
            self.nw_level = None
        return self


class AdminTaskUpdateRequest(AdminTaskCreateRequest):
    pass


class AdminQuestCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    continent: Continent
    min_level: int = Field(ge=5, le=625)
    nw_level: int | None = Field(default=None, ge=1, le=999)
    reward_text: str | None = None
    is_active: bool = True

    @field_validator("continent", mode="before")
    @classmethod
    def normalize_continent(cls, value):
        text = str(value or "").strip().lower()
        if text == "nightmare":
            return "nightmare_world"
        return text

    @model_validator(mode="after")
    def validate_nw_level(self):
        if self.continent == "nightmare_world":
            if self.nw_level is None:
                raise ValueError("NW Level é obrigatório para continente Nightmare World")
        else:
            self.nw_level = None
        return self


class AdminQuestUpdateRequest(AdminQuestCreateRequest):
    pass


class AdminHuntItemAliasResponse(BaseModel):
    id: int
    observed_name: str
    observed_name_normalized: str
    canonical_name: str | None = None
    canonical_name_normalized: str | None = None
    is_approved: bool
    occurrences: int
    last_seen_at: datetime
    created_at: datetime
    updated_at: datetime


class AdminHuntItemAliasUpdateRequest(BaseModel):
    canonical_name: str | None = None
    is_approved: bool = True


class AdminNpcPriceResponse(BaseModel):
    name: str
    normalized_name: str
    unit_price: float
    related_aliases: list[str] = []


class AdminNpcPriceUpdateRequest(BaseModel):
    previous_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    unit_price: float = Field(ge=0)


class AdminOcrDebugSettingsResponse(BaseModel):
    debug_ocr_enabled: bool


class AdminOcrDebugSettingsUpdateRequest(BaseModel):
    debug_ocr_enabled: bool


class AdminOcrDebugSessionResponse(BaseModel):
    session_id: str
    created_at: datetime
    file_count: int


class AdminOcrDebugFileResponse(BaseModel):
    name: str
    kind: str
    size_bytes: int
    modified_at: datetime


class AdminOcrDebugTextPreviewResponse(BaseModel):
    file_name: str
    content: str


class AdminPokemonEntry(BaseModel):
    dex_id: str
    name: str
    full_name: str


class AdminPokemonCreateRequest(BaseModel):
    dex_id: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=120)


class AdminPokemonUpdateRequest(BaseModel):
    original_full_name: str = Field(min_length=1)
    dex_id: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=120)


class AdminSidebarMenuSettingResponse(BaseModel):
    menu_key: str
    label: str
    path: str
    sort_order: int
    is_enabled: bool
    is_beta: bool


class AdminSidebarMenuSettingUpdateRequest(BaseModel):
    is_enabled: bool
    is_beta: bool

