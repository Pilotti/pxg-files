from __future__ import annotations

import logging

from app.db.base import Base
from app.db.session import SessionLocal, engine

from app.core.config import settings
from app.models.catalog import ConsumableCatalogItem, HuntNpcPrice, PokemonEntry
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.character import Character
from app.models.tasks import TaskTemplate, QuestTemplate, CharacterTask, CharacterQuest
from app.models.hunt_item_alias import HuntItemAlias
from app.models.hunt_session import HuntSession
from app.models.sidebar_menu import SidebarMenuSetting
from app.services.catalog_seed import seed_database_catalogs_if_empty
from app.services.task_json_storage import (
    TASK_SEED_JSON_DIR,
    ensure_task_json_files,
    import_task_templates_from_json_files,
)
from app.services.quest_json_storage import (
    QUEST_SEED_JSON_DIR,
    ensure_quest_json_files,
    import_quest_templates_from_json_files,
)


logger = logging.getLogger(__name__)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    # Column migrations for existing tables (safe, idempotent via IF NOT EXISTS)
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            if engine.dialect.name == "postgresql":
                column_type = conn.execute(text(
                    "SELECT data_type "
                    "FROM information_schema.columns "
                    "WHERE table_name = 'task_templates' AND column_name = 'task_type'"
                )).scalar_one_or_none()

                if column_type and column_type.lower() != "jsonb":
                    conn.execute(text(
                        "ALTER TABLE task_templates "
                        "ALTER COLUMN task_type TYPE JSONB "
                        "USING CASE "
                        "WHEN task_type IS NULL OR btrim(task_type::text) = '' THEN '[]'::jsonb "
                        "WHEN left(task_type::text, 1) = '[' THEN task_type::jsonb "
                        "ELSE jsonb_build_array(task_type::text) "
                        "END"
                    ))

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
                "ALTER TABLE quest_templates "
                "ADD COLUMN IF NOT EXISTS city VARCHAR(80)"
            ))
            conn.execute(text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'pt'"
            ))
            conn.execute(text(
                "UPDATE users "
                "SET preferred_language = 'pt' "
                "WHERE preferred_language IS NULL OR preferred_language = ''"
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

            # Ensure sidebar table and columns exist on legacy databases.
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS sidebar_menu_settings ("
                "id SERIAL PRIMARY KEY, "
                "menu_key VARCHAR(40) NOT NULL UNIQUE, "
                "label VARCHAR(80) NOT NULL, "
                "path VARCHAR(120) NOT NULL, "
                "sort_order INTEGER NOT NULL DEFAULT 0, "
                "is_enabled BOOLEAN NOT NULL DEFAULT TRUE, "
                "is_beta BOOLEAN NOT NULL DEFAULT FALSE, "
                "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
                "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                ")"
            ))
            conn.execute(text(
                "ALTER TABLE sidebar_menu_settings "
                "ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"
            ))
            conn.execute(text(
                "ALTER TABLE sidebar_menu_settings "
                "ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE"
            ))
            conn.execute(text(
                "ALTER TABLE sidebar_menu_settings "
                "ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            conn.execute(text(
                "ALTER TABLE sidebar_menu_settings "
                "ADD COLUMN IF NOT EXISTS label VARCHAR(80)"
            ))
            conn.execute(text(
                "ALTER TABLE sidebar_menu_settings "
                "ADD COLUMN IF NOT EXISTS path VARCHAR(120)"
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
            conn.execute(text(
                "INSERT INTO sidebar_menu_settings (menu_key, label, path, sort_order, is_enabled, is_beta) "
                "VALUES ('rainbow_orbs', 'Rainbow Orbs', '/rainbow-orbs', 6, true, false) "
                "ON CONFLICT (menu_key) DO NOTHING"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("Falha critica durante migracoes de banco.")
            raise

    ensure_task_json_files()
    ensure_quest_json_files()

    db = SessionLocal()
    try:
        if settings.use_database_catalog:
            seed_database_catalogs_if_empty(db)
            if db.query(TaskTemplate.id).first() is None:
                import_task_templates_from_json_files(db, json_dir=TASK_SEED_JSON_DIR)
        else:
            import_task_templates_from_json_files(db)
    except Exception as exc:
        print(f"Falha ao sincronizar task JSONs: {exc}")
        db.rollback()
    finally:
        db.close()

    db = SessionLocal()
    try:
        if settings.use_database_catalog:
            if db.query(QuestTemplate.id).first() is None:
                import_quest_templates_from_json_files(db, json_dir=QUEST_SEED_JSON_DIR)
        else:
            import_quest_templates_from_json_files(db)
    except Exception as exc:
        print(f"Falha ao sincronizar quest JSONs: {exc}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
