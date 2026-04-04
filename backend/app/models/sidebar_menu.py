from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.base import Base


class SidebarMenuSetting(Base):
    __tablename__ = "sidebar_menu_settings"

    id = Column(Integer, primary_key=True, index=True)
    menu_key = Column(String(40), nullable=False, unique=True, index=True)
    label = Column(String(80), nullable=False)
    path = Column(String(120), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    is_beta = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )