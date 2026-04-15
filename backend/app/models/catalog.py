from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func

from app.db.base import Base


class PokemonEntry(Base):
    __tablename__ = "pokemon_entries"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(180), nullable=False, unique=True, index=True)
    dex_id = Column(String(10), nullable=False, default="", server_default="")
    name = Column(String(160), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class HuntNpcPrice(Base):
    __tablename__ = "hunt_npc_prices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    normalized_name = Column(String(160), nullable=False, unique=True, index=True)
    unit_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ConsumableCatalogItem(Base):
    __tablename__ = "consumable_catalog_items"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(160), nullable=False)
    normalized_name = Column(String(160), nullable=False, unique=True, index=True)
    preco_npc = Column(Float, nullable=False, default=0.0)
    categoria = Column(String(120), nullable=False, default="", server_default="")
    normalized_category = Column(String(120), nullable=False, default="", server_default="", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class HuntPlayerPrice(Base):
    __tablename__ = "hunt_player_prices"
    __table_args__ = (
        UniqueConstraint("account_id", "normalized_name", name="uq_hunt_player_price_account_item"),
    )

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(160), nullable=False)
    normalized_name = Column(String(160), nullable=False, index=True)
    player_unit_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
