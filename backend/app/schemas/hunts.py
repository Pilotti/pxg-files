from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HuntDropRow(BaseModel):
    id: int
    name: str
    name_display: str
    name_normalized: str
    quantity: float
    npc_total_price: float
    npc_unit_price: float
    player_unit_price: float = 0
    player_total_price: float = 0
    duplicate_key: str = ""


class HuntDropSummary(BaseModel):
    processed_images: int = 0
    recognized_lines: int = 0
    duplicates_ignored: int = 0
    final_rows: int = 0


class HuntDropsOcrResponse(BaseModel):
    rows: List[HuntDropRow] = Field(default_factory=list)
    summary: HuntDropSummary = Field(default_factory=HuntDropSummary)
    warnings: List[str] = Field(default_factory=list)


# ---------- Hunt Session -------------------------------------------------------

class HuntEnemyEntry(BaseModel):
    name: str
    quantity: int


class HuntSessionSaveRequest(BaseModel):
    character_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    hunt_date: Optional[datetime] = None
    drops: List[Dict[str, Any]] = Field(default_factory=list)
    enemies: List[HuntEnemyEntry] = Field(default_factory=list)
    consumables: List["HuntConsumableEntry"] = Field(default_factory=list)


class HuntConsumableEntry(BaseModel):
    name: str
    quantity: int
    preco_npc: float = 0.0


class HuntSessionListItem(BaseModel):
    id: int
    character_id: Optional[int]
    duration_minutes: Optional[int]
    notes: Optional[str]
    hunt_date: datetime
    total_npc_value: float
    total_player_value: float
    total_enemies: int
    total_consumables_cost: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class HuntSessionDetail(HuntSessionListItem):
    drops_json: List[Dict[str, Any]] = Field(default_factory=list)
    enemies_json: List[Dict[str, Any]] = Field(default_factory=list)
    consumables_json: List[Dict[str, Any]] = Field(default_factory=list)
