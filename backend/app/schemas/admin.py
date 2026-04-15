from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator
from datetime import datetime
import re

from app.schemas.tasks import Continent, TaskType


TrimmedText160 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class AdminLoginRequest(BaseModel):
    username: TrimmedText160
    password: str = Field(min_length=1)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminMeResponse(BaseModel):
    username: str
    role: str = "admin"


class AdminUserListItem(BaseModel):
    id: int
    username: str
    email: str


class AdminTaskCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1)
    task_type: list[TaskType] = Field(min_length=1)
    continent: Continent
    min_level: int = Field(default=5, ge=0, le=625)
    nw_level: int | None = Field(default=None, ge=1, le=999)
    reward_text: str = Field(min_length=1)
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
    def strip_required_text_fields(cls, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("Campo obrigatório")
        return cleaned

    @field_validator("min_level", mode="before")
    @classmethod
    def normalize_min_level(cls, value):
        if value in (None, ""):
            return 5
        return value

    @field_validator("coordinate", mode="before")
    @classmethod
    def normalize_coordinate(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        cleaned = str(value).strip()
        if not re.fullmatch(r"-?\d{1,7}\s*,\s*-?\d{1,7}\s*,\s*-?\d{1,7}", cleaned):
            raise ValueError("Coordenada deve estar no formato x,y,z (números podem ser negativos)")
        parts = [int(part.strip()) for part in cleaned.split(",")]
        if any(part < -1_000_000 or part > 1_000_000 for part in parts):
            raise ValueError("Cada coordenada deve estar entre -1000000 e 1000000")
        return ",".join(str(part) for part in parts)

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
    city: str | None = None
    min_level: int = Field(ge=0, le=625)
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


class AdminHuntItemAliasCreateRequest(BaseModel):
    observed_name: str = Field(min_length=1, max_length=160)
    canonical_name: str = Field(min_length=1, max_length=160)


class AdminNpcPriceResponse(BaseModel):
    name: str
    normalized_name: str
    unit_price: float
    related_aliases: list[str] = []


class AdminNpcPriceListResponse(BaseModel):
    items: list[AdminNpcPriceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminNpcPriceUpdateRequest(BaseModel):
    previous_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    unit_price: float = Field(ge=0)


class AdminNpcPriceCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    unit_price: float = Field(ge=0)


class AdminConsumableResponse(BaseModel):
    nome: str
    preco_npc: float
    categoria: str = ""


class AdminConsumableListResponse(BaseModel):
    items: list[AdminConsumableResponse]
    available_categories: list[str] = []
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminOcrReviewItem(BaseModel):
    filename: str
    size_bytes: int
    created_at: datetime
    status: str = "pending"
    notes: str | None = None
    include_in_training: bool = False
    updated_at: datetime | None = None
    last_reprocessed_at: datetime | None = None
    last_reprocess_outcome: str | None = None
    last_reprocess_rows: int | None = None
    last_reprocess_duplicates: int | None = None
    last_reprocess_message: str | None = None


class AdminOcrReviewListResponse(BaseModel):
    items: list[AdminOcrReviewItem]
    total: int


class AdminOcrReviewUpdateRequest(BaseModel):
    status: str = Field(min_length=1, max_length=32)
    notes: str | None = Field(default=None, max_length=400)
    include_in_training: bool = False


class AdminOcrReviewReprocessResponse(BaseModel):
    detail: str
    outcome: str
    recognized_rows: int = 0
    duplicates_ignored: int = 0


class AdminConsumableCreateRequest(BaseModel):
    nome: str = Field(min_length=1)
    preco_npc: float = Field(ge=0)
    categoria: str = ""


class AdminConsumableUpdateRequest(BaseModel):
    previous_nome: str = Field(min_length=1)
    nome: str = Field(min_length=1)
    preco_npc: float = Field(ge=0)
    categoria: str = ""


class AdminPokemonEntry(BaseModel):
    dex_id: str
    name: str
    full_name: str


class AdminPokemonListResponse(BaseModel):
    items: list[AdminPokemonEntry]
    total: int
    page: int
    page_size: int
    total_pages: int


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
