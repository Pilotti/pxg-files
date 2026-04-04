from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.base import Base


class HuntItemAlias(Base):
    __tablename__ = "hunt_item_aliases"

    id = Column(Integer, primary_key=True, index=True)

    observed_name = Column(String(160), nullable=False)
    observed_name_normalized = Column(String(160), nullable=False, unique=True, index=True)

    canonical_name = Column(String(160), nullable=True)
    canonical_name_normalized = Column(String(160), nullable=True, index=True)

    is_approved = Column(Boolean, nullable=False, default=False, server_default="false")
    occurrences = Column(Integer, nullable=False, default=1, server_default="1")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
