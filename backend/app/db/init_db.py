from __future__ import annotations

from app.db.base import Base
from app.db.session import engine

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.character import Character
from app.models.tasks import TaskTemplate, QuestTemplate, CharacterTask, CharacterQuest
from app.models.hunt_item_alias import HuntItemAlias
from app.models.hunt_session import HuntSession
from app.models.sidebar_menu import SidebarMenuSetting


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    # Column migrations for existing tables (safe, idempotent via IF NOT EXISTS)
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE hunt_sessions "
                "ADD COLUMN IF NOT EXISTS consumables_json JSON"
            ))
            conn.execute(text(
                "ALTER TABLE hunt_sessions "
                "ADD COLUMN IF NOT EXISTS total_consumables_cost FLOAT DEFAULT 0.0"
            ))
            conn.execute(text(
                "ALTER TABLE task_templates "
                "ADD COLUMN IF NOT EXISTS npc_name VARCHAR(120)"
            ))
            conn.execute(text(
                "ALTER TABLE task_templates "
                "ADD COLUMN IF NOT EXISTS coordinate VARCHAR(80)"
            ))
            conn.execute(text(
                "ALTER TABLE task_templates "
                "ADD COLUMN IF NOT EXISTS city VARCHAR(80)"
            ))
            conn.execute(text(
                "ALTER TABLE task_templates "
                "ADD COLUMN IF NOT EXISTS nw_level INTEGER"
            ))
            conn.execute(text(
                "ALTER TABLE quest_templates "
                "ADD COLUMN IF NOT EXISTS nw_level INTEGER"
            ))
            conn.execute(text(
                "UPDATE task_templates "
                "SET continent = 'nightmare_world' "
                "WHERE continent = 'nightmare'"
            ))
            conn.execute(text(
                "UPDATE quest_templates "
                "SET continent = 'nightmare_world' "
                "WHERE continent = 'nightmare'"
            ))
            conn.execute(text(
                "INSERT INTO sidebar_menu_settings (menu_key, label, path, sort_order, is_enabled, is_beta) "
                "VALUES "
                "('inicio', 'Início', '/inicio', 1, true, false), "
                "('hunts', 'Hunts', '/hunts', 2, true, false), "
                "('tasks', 'Tasks', '/tasks', 3, true, false), "
                "('quests', 'Quests', '/quests', 4, true, false), "
                "('diarias', 'Diárias', '/diarias', 5, true, false) "
                "ON CONFLICT (menu_key) DO NOTHING"
            ))
            conn.commit()
        except Exception:
            conn.rollback()

    # Seed base catalog when a fresh database starts in production.
    try:
        from app.db.seed_tasks import seed_tasks, seed_quests

        seed_tasks()
        seed_quests()
    except Exception as exc:
        # Keep startup resilient even if seed data has inconsistencies.
        print(f"[init_db] seed sync skipped due to error: {exc}")


if __name__ == "__main__":
    init_db()
