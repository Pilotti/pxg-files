def calculate_hunt_summary(duration_minutes: int, drops: list[dict], expenses: list[dict], enemies: list[dict], bonuses: list[dict] | None = None) -> dict:
    bonuses = bonuses or []
    hours = duration_minutes / 60 if duration_minutes else 0

    total_npc = sum(int(item["quantity"]) * int(item["npc_price"]) for item in drops)
    total_player = sum(int(item["quantity"]) * int(item["player_price"]) for item in drops)
    total_expenses = sum(int(item["quantity"]) * int(item["npc_price"]) for item in expenses)
    total_enemies = sum(int(item["quantity"]) for item in enemies)
    total_bonus_minutes = sum(int(item["quantity"]) * int(item["duration_minutes"]) for item in bonuses)

    loot_balance_npc = total_npc - total_expenses
    loot_balance_player = total_player - total_expenses

    return {
        "total_npc": total_npc,
        "total_player": total_player,
        "total_expenses": total_expenses,
        "total_bonus_minutes": total_bonus_minutes,
        "loot_balance_npc": loot_balance_npc,
        "loot_balance_player": loot_balance_player,
        "loot_balance_npc_per_hour": round(loot_balance_npc / hours) if hours > 0 else 0,
        "loot_balance_player_per_hour": round(loot_balance_player / hours) if hours > 0 else 0,
        "total_enemies": total_enemies,
        "enemies_per_hour": round(total_enemies / hours) if hours > 0 else 0,
    }
