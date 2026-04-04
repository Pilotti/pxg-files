from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.types import JSON

from app.db.base import Base


class HuntSession(Base):
    __tablename__ = "hunt_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"), nullable=True, index=True)

    # User-supplied metadata
    duration_minutes = Column(Integer, nullable=True)
    notes = Column(String(500), nullable=True)
    hunt_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Persisted payload snapshots
    drops_json = Column(JSON, nullable=False, server_default="[]")
    enemies_json = Column(JSON, nullable=False, server_default="[]")

    # Pre-computed totals for fast listing queries
    total_npc_value = Column(Float, nullable=False, default=0.0)
    total_player_value = Column(Float, nullable=False, default=0.0)
    total_enemies = Column(Integer, nullable=False, default=0)
    total_consumables_cost = Column(Float, nullable=True, default=0.0)

    consumables_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
