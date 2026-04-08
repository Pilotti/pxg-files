from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class TaskTemplate(Base):
    __tablename__ = "task_templates"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)

    task_type = Column(JSON, nullable=False, default=list)
    continent = Column(String(40), nullable=False, index=True)

    min_level = Column(Integer, nullable=False, index=True)
    nw_level = Column(Integer, nullable=True, index=True)

    reward_text = Column(Text, nullable=True)
    npc_name = Column(String(120), nullable=True)
    coordinate = Column(String(80), nullable=True)
    city = Column(String(80), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    character_tasks = relationship(
        "CharacterTask",
        back_populates="task_template",
        cascade="all, delete-orphan",
    )


class QuestTemplate(Base):
    __tablename__ = "quest_templates"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)

    continent = Column(String(40), nullable=False, index=True)
    city = Column(String(80), nullable=True, index=True)

    min_level = Column(Integer, nullable=False, index=True)
    nw_level = Column(Integer, nullable=True, index=True)

    reward_text = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    character_quests = relationship(
        "CharacterQuest",
        back_populates="quest_template",
        cascade="all, delete-orphan",
    )


class CharacterTask(Base):
    __tablename__ = "character_tasks"
    __table_args__ = (
        UniqueConstraint("character_id", "task_template_id", name="uq_character_task"),
    )

    id = Column(Integer, primary_key=True, index=True)

    character_id = Column(
        Integer,
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_template_id = Column(
        Integer,
        ForeignKey("task_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_completed = Column(Boolean, nullable=False, default=False, server_default="false")

    activated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    task_template = relationship("TaskTemplate", back_populates="character_tasks")


class CharacterQuest(Base):
    __tablename__ = "character_quests"
    __table_args__ = (
        UniqueConstraint("character_id", "quest_template_id", name="uq_character_quest"),
    )

    id = Column(Integer, primary_key=True, index=True)

    character_id = Column(
        Integer,
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quest_template_id = Column(
        Integer,
        ForeignKey("quest_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_completed = Column(Boolean, nullable=False, default=False, server_default="false")

    activated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    quest_template = relationship("QuestTemplate", back_populates="character_quests")