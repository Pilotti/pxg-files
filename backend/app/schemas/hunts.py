from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StringConstraints


TrimmedText160 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
TrimmedNotes = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


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
    session_id: str | None = None
    manual_review_available: bool = False


# ---------- Hunt Session -------------------------------------------------------

class HuntEnemyEntry(BaseModel):
    name: TrimmedText160
    quantity: int = Field(ge=1, le=1_000_000)


class HuntSessionDropEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: TrimmedText160
    name_normalized: str | None = Field(
        default=None,
        validation_alias=AliasChoices("name_normalized", "nameNormalized"),
    )
    quantity: float = Field(ge=0, le=1_000_000)
    npc_unit_price: float = Field(
        default=0,
        ge=0,
        le=1_000_000_000,
        validation_alias=AliasChoices("npc_unit_price", "npcUnitPrice"),
    )
    npc_total_price: float = Field(
        default=0,
        ge=0,
        le=1_000_000_000_000,
        validation_alias=AliasChoices("npc_total_price", "npcTotalPrice"),
    )
    player_unit_price: float = Field(
        default=0,
        ge=0,
        le=1_000_000_000,
        validation_alias=AliasChoices("player_unit_price", "playerUnitPrice"),
    )
    player_total_price: float = Field(
        default=0,
        ge=0,
        le=1_000_000_000_000,
        validation_alias=AliasChoices("player_total_price", "playerTotalPrice"),
    )

    def to_storage_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "nameNormalized": self.name_normalized,
            "quantity": self.quantity,
            "npcUnitPrice": self.npc_unit_price,
            "npcTotalPrice": self.npc_total_price,
            "playerUnitPrice": self.player_unit_price,
            "playerTotalPrice": self.player_total_price,
        }


class HuntSessionSaveRequest(BaseModel):
    character_id: Optional[int] = None
    duration_minutes: Optional[int] = Field(default=None, ge=0, le=10080)
    notes: Optional[TrimmedNotes] = None
    hunt_date: Optional[datetime] = None
    drops: List[HuntSessionDropEntry] = Field(default_factory=list, max_length=500)
    enemies: List[HuntEnemyEntry] = Field(default_factory=list)
    consumables: List["HuntConsumableEntry"] = Field(default_factory=list)


class HuntConsumableEntry(BaseModel):
    name: TrimmedText160
    quantity: int = Field(ge=1, le=1_000_000)
    preco_npc: float = Field(default=0.0, ge=0, le=1_000_000_000)
    categoria: str | None = Field(default=None, max_length=120)


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
