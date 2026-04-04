from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TaskType = Literal["item_delivery", "defeat", "capture", "outro"]
Continent = Literal["kanto", "johto", "orange_islands", "outland", "nightmare_world", "orre"]
TemplateStatus = Literal["available", "active", "completed"]


class TaskTemplateBase(BaseModel):
    name: str
    description: str | None = None
    task_type: list[TaskType]
    continent: Continent
    min_level: int = Field(ge=0, le=625)
    nw_level: int | None = Field(default=None, ge=1, le=999)
    reward_text: str | None = None
    npc_name: str | None = None
    coordinate: str | None = None
    city: str | None = None
    is_active: bool


class QuestTemplateBase(BaseModel):
    name: str
    description: str | None = None
    continent: Continent
    min_level: int = Field(ge=0, le=625)
    nw_level: int | None = Field(default=None, ge=1, le=999)
    reward_text: str | None = None
    is_active: bool


class TaskCatalogResponse(TaskTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: TemplateStatus


class QuestCatalogResponse(QuestTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: TemplateStatus


class CharacterTaskItem(BaseModel):
    id: int
    template_id: int
    name: str
    description: str | None = None
    task_type: list[TaskType]
    continent: Continent
    min_level: int
    nw_level: int | None = None
    reward_text: str | None = None
    npc_name: str | None = None
    coordinate: str | None = None
    city: str | None = None
    is_completed: bool
    activated_at: datetime | None = None
    completed_at: datetime | None = None


class CharacterQuestItem(BaseModel):
    id: int
    template_id: int
    name: str
    description: str | None = None
    continent: Continent
    min_level: int
    nw_level: int | None = None
    reward_text: str | None = None
    is_completed: bool
    activated_at: datetime | None = None
    completed_at: datetime | None = None


class ActionResponse(BaseModel):
    detail: str