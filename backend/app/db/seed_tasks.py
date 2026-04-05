import json
from pathlib import Path

from app.db.session import SessionLocal
from app.models.tasks import TaskTemplate, QuestTemplate


def normalize_task_type(task_type_str):
    """Normalize task type string to lowercase and handle aliases"""
    normalized = str(task_type_str).lower().strip()
    
    # Handle Portuguese and English variations
    if normalized in ["entrega", "item_delivery"]:
        return "item_delivery"
    elif normalized in ["derrotar", "defeat"]:
        return "defeat"
    elif normalized in ["captura", "capture"]:
        return "capture"
    elif normalized == "outro":
        return "outro"
    
    return normalized


def normalize_continent(continent_value):
    normalized = str(continent_value or "").strip().lower()
    if normalized == "nightmare":
        return "nightmare_world"
    return normalized


def load_versioned_tasks_file(file_name, label):
    data_file = Path(__file__).resolve().parents[1] / "data" / file_name
    if not data_file.exists():
        return []

    try:
        raw_data = json.loads(data_file.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Erro ao ler {label}: {exc}")
        return []

    if not isinstance(raw_data, list):
        print(f"{label} inválido: esperado array de tasks.")
        return []

    normalized_tasks = []
    for item in raw_data:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or "").strip()
        continent = normalize_continent(item.get("continent"))
        if not name or not continent:
            continue

        raw_task_type = item.get("task_type")
        if isinstance(raw_task_type, list):
            task_type = [normalize_task_type(value) for value in raw_task_type if str(value).strip()]
        elif raw_task_type is None:
            task_type = []
        else:
            task_type = [normalize_task_type(raw_task_type)]

        if not task_type:
            task_type = ["outro"]

        nw_level = item.get("nw_level")
        if nw_level in ("", None):
            nw_level = None
        else:
            try:
                nw_level = int(nw_level)
            except Exception:
                nw_level = None

        try:
            min_level = int(item.get("min_level", 0))
        except Exception:
            min_level = 0

        normalized_tasks.append(
            {
                "name": name,
                "description": item.get("description"),
                "task_type": task_type,
                "continent": continent,
                "min_level": min_level,
                "nw_level": nw_level,
                "reward_text": item.get("reward_text"),
                "npc_name": item.get("npc_name") or name,
                "coordinate": item.get("coordinate") or "0,0,0",
                "city": item.get("city"),
                "is_active": bool(item.get("is_active", True)),
            }
        )

    return normalized_tasks


# ========================
# TASKS
# ========================

tasks = [
    {
        "name": "Susan",
        "description": "Entregar 1 Chocolate Bar",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "30 dl",
        "npc_name": "Susan",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Ida",
        "description": "Entregar 10 Fox Tail, 15 Fire Horse Foot",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "35130 dl",
        "npc_name": "Ida",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Sid",
        "description": "Entregar 20 Fire Tail, 30 Giant Piece of Fur",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "24120 dl",
        "npc_name": "Sid",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Waldo",
        "description": "Entregar 10 Rat Tail, 20 Bat Wing",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "6300 dl",
        "npc_name": "Waldo",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Carli",
        "description": "Derrotar 30 Rattata, 30 Zubat",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "4125 EXP",
        "npc_name": "Carli",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Joshua",
        "description": "Derrotar 90 Charizard, 60 Charmeleon, 60 Charmander",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "162000 EXP",
        "npc_name": "Joshua",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Charlotte",
        "description": "Derrotar 30 Ponyta, 30 Vulpix",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "11813 EXP",
        "npc_name": "Charlotte",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    {
        "name": "Royce",
        "description": "Derrotar 90 Magmar",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "121500 EXP",
        "npc_name": "Royce",
        "coordinate": "0,0,0",
        "city": "Cerulean"
    },
    # NEW TASKS
    {
        "name": "Hawk",
        "description": "Derrotar 60 Dragonite e 60 Tyranitar",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "360.000 EXP",
        "npc_name": "Hawk",
        "coordinate": "0,0,0",
        "city": "Lance's Island"
    },
    {
        "name": "Prince Adam",
        "description": "Entregar 12 Dragon Tail",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$16.200",
        "npc_name": "Prince Adam",
        "coordinate": "0,0,0",
        "city": "Charicific Valley"
    },
    {
        "name": "Rhys",
        "description": "Entregar 40 Pot Of Lava",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$2.160",
        "npc_name": "Rhys",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Tweety Pie",
        "description": "Entregar 10 Giant Fins",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$5.400",
        "npc_name": "Tweety Pie",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Bart",
        "description": "Derrotar 60 Piloswine e 60 Swinub",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "84.375 EXP",
        "npc_name": "Bart",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Kathrin",
        "description": "Entregar 10 Strange Spike, 10 Ice Bra e 10 Seal Tail",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$38.460",
        "npc_name": "Kathrin",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Shaun",
        "description": "Derrotar 60 Jynx e 60 Smoochum",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "101.250 EXP",
        "npc_name": "Shaun",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Rudolph",
        "description": "Entregar 15 Tusk, 15 Gift Bag e 15 Cat Ear",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$17.685",
        "npc_name": "Rudolph",
        "coordinate": "0,0,0",
        "city": "Seafoam Island"
    },
    {
        "name": "Zulu",
        "description": "Derrotar 300 Venusaur e 300 Meganium",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "810.000 EXP",
        "npc_name": "Zulu",
        "coordinate": "0,0,0",
        "city": "Butterfree's Island"
    },
    {
        "name": "Caesar",
        "description": "Derrotar 300 Charizard e 300 Typhlosion",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "810.000 EXP",
        "npc_name": "Caesar",
        "coordinate": "0,0,0",
        "city": "Butterfree's Island"
    },
    {
        "name": "Li Mu Bai",
        "description": "Derrotar 300 Blastoise e 300 Feraligatr",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "810.000 EXP",
        "npc_name": "Li Mu Bai",
        "coordinate": "0,0,0",
        "city": "Butterfree's Island"
    },
    {
        "name": "Ary The Great",
        "description": "Entregar 20 Strange Tail",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$10.800",
        "npc_name": "Ary The Great",
        "coordinate": "0,0,0",
        "city": "Desert Island"
    },
    {
        "name": "Mohamed",
        "description": "Entregar 1 Orange Juice",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$300",
        "npc_name": "Mohamed",
        "coordinate": "0,0,0",
        "city": "Desert Island"
    },
    {
        "name": "Jake Sully",
        "description": "Derrotar 90 Blastoise, 60 Wartortle e 60 Squirtle",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "162.000 EXP",
        "npc_name": "Jake Sully",
        "coordinate": "0,0,0",
        "city": "Power Plant"
    },
    {
        "name": "Emmett",
        "description": "Entregar 15 Electric Rat Tail e 15 Sheep Wool",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "$11.800",
        "npc_name": "Emmett",
        "coordinate": "0,0,0",
        "city": "Power Plant"
    },
    {
        "name": "Elektra",
        "description": "Derrotar 90 Electabuzz e 90 Elekid",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "151.875 EXP",
        "npc_name": "Elektra",
        "coordinate": "0,0,0",
        "city": "Power Plant"
    },
    {
        "name": "Mork",
        "description": "Entregar 1 Max Revive, derrotar 100 Pidgeot e 1 Shiny Pidgeot",
        "task_type": ["defeat", "item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "Após derrotar os Pidgeot: 100.000 EXP, após derrotar o Shiny Pidgeot: 150.000 EXP",
        "npc_name": "Mork",
        "coordinate": "0,0,0",
        "city": "Hurricane Island"
    },
    {
        "name": "Gina",
        "description": "Necessário nível 30, encontrar 5 Natural Herbs nas coordenadas 3920,3746,7; 3872,3797,7; 3818,3777,6; 3905,3772,6; 3899,3843,6",
        "task_type": ["capture"],
        "continent": "kanto",
        "min_level": 30,
        "reward_text": "100.000 EXP",
        "npc_name": "Gina",
        "coordinate": "0,0,0",
        "city": "Jungle Island"
    },
    {
        "name": "Hiker",
        "description": "Duelo contra Onix, Machamp, Rhydon, Omastar, Golem e Kabutops",
        "task_type": ["defeat"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "150.000 EXP",
        "npc_name": "Hiker",
        "coordinate": "0,0,0",
        "city": "Jungle Island"
    },
    {
        "name": "Melvin",
        "description": "Encontrar capa de mágico nas coordenadas 3695,4206,8",
        "task_type": ["capture"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "100.000 EXP",
        "npc_name": "Melvin",
        "coordinate": "0,0,0",
        "city": "Leaf Island"
    },
    {
        "name": "Margarida",
        "description": "Capturar e entregar Xatu",
        "task_type": ["capture"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "150.000 EXP, 100 Empty Ultra Balls, 1 Enigma Stone",
        "npc_name": "Margarida",
        "coordinate": "0,0,0",
        "city": "Leaf Island"
    },
    {
        "name": "Natalya",
        "description": "Entregar 10 Linearly Guided Hypnosis, 2 Mimic Clothes e 10 Psychic Spoons",
        "task_type": ["item_delivery"],
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "100.000 EXP, $20.000",
        "npc_name": "Natalya",
        "coordinate": "0,0,0",
        "city": "Leaf Island"
    },
]


# ========================
# QUESTS
# ========================

quests = [
    {
        "name": "Primeira Jornada",
        "description": "Complete a introdução do jogo",
        "continent": "kanto",
        "min_level": 5,
        "reward_text": "Starter + 10k"
    },
    {
        "name": "Explorador de Johto",
        "description": "Visite todas as cidades de Johto",
        "continent": "johto",
        "min_level": 50,
        "reward_text": "50k + bônus de viagem"
    }
]


def seed_tasks():
    db = SessionLocal()
    try:
        catalog_tasks = load_versioned_tasks_file("tasks_to_add.json", "tasks_to_add.json")
        nightmare_tasks = load_versioned_tasks_file("nightmare_tasks.json", "nightmare_tasks.json")
        all_tasks = tasks + catalog_tasks + nightmare_tasks

        if catalog_tasks:
            print(f"tasks_to_add.json carregado: {len(catalog_tasks)} tasks")

        if nightmare_tasks:
            print(f"nightmare_tasks.json carregado: {len(nightmare_tasks)} tasks")

        existing_keys = set(db.query(TaskTemplate.name, TaskTemplate.continent).all())
        added = 0
        skipped = 0
        for task in all_tasks:
            key = (task["name"], task["continent"])

            if key in existing_keys:
                skipped += 1
                continue

            db.add(TaskTemplate(**task))
            existing_keys.add(key)
            added += 1

        db.commit()
        print(f"Tasks sincronizadas: {added} adicionadas, {skipped} já existentes.")
    finally:
        db.close()


def seed_quests():
    db = SessionLocal()
    try:
        added = 0
        skipped = 0
        for quest in quests:
            existing = (
                db.query(QuestTemplate)
                .filter(
                    QuestTemplate.name == quest["name"],
                    QuestTemplate.continent == quest["continent"],
                )
                .first()
            )

            if existing:
                skipped += 1
                continue

            db.add(QuestTemplate(**quest))
            added += 1

        db.commit()
        print(f"Quests sincronizadas: {added} adicionadas, {skipped} já existentes.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_tasks()
    seed_quests()
