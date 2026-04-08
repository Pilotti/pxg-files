from __future__ import annotations

import unicodedata
from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.hunt_item_alias import HuntItemAlias
from app.services.hunt_npc_prices import has_npc_price_item


def normalize_item_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name or "")
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = " ".join(normalized.lower().split())
    cleaned = []
    for char in normalized:
        if char.isalnum() or char == " ":
            cleaned.append(char)
    return " ".join("".join(cleaned).split())


def register_observed_item(db: Session, observed_name: str) -> HuntItemAlias | None:
    observed = (observed_name or "").strip()
    normalized = normalize_item_name(observed)
    if not normalized:
        return None

    auto_approve = has_npc_price_item(observed)

    alias = (
        db.query(HuntItemAlias)
        .filter(HuntItemAlias.observed_name_normalized == normalized)
        .first()
    )

    now = datetime.now(timezone.utc)

    if alias is None:
        alias = HuntItemAlias(
            observed_name=observed,
            observed_name_normalized=normalized,
            canonical_name=observed if auto_approve else None,
            canonical_name_normalized=normalized if auto_approve else None,
            is_approved=auto_approve,
            occurrences=1,
            last_seen_at=now,
        )
        db.add(alias)
        db.flush()
        return alias

    alias.occurrences = int(alias.occurrences or 0) + 1
    alias.last_seen_at = now

    if len(observed) > len(alias.observed_name or ""):
        alias.observed_name = observed

    if auto_approve:
        alias.canonical_name = observed
        alias.canonical_name_normalized = normalized
        alias.is_approved = True

    db.flush()
    return alias


def resolve_canonical_name(db: Session, observed_name: str) -> str:
    observed = (observed_name or "").strip()
    normalized = normalize_item_name(observed)
    if not normalized:
        return observed

    alias = (
        db.query(HuntItemAlias)
        .filter(HuntItemAlias.observed_name_normalized == normalized)
        .first()
    )

    if alias and alias.is_approved and alias.canonical_name:
        return alias.canonical_name.strip()

    return observed


def list_hunt_item_aliases(
    db: Session,
    search: str | None = None,
    status: str = "pending",
) -> list[HuntItemAlias]:
    query = db.query(HuntItemAlias)

    if status == "approved":
        query = query.filter(HuntItemAlias.is_approved.is_(True))
    elif status == "pending":
        query = query.filter(HuntItemAlias.is_approved.is_(False))

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            (HuntItemAlias.observed_name.ilike(like))
            | (HuntItemAlias.canonical_name.ilike(like))
        )

    return query.order_by(HuntItemAlias.last_seen_at.desc(), HuntItemAlias.id.desc()).all()


def update_hunt_item_alias(
    db: Session,
    alias_id: int,
    canonical_name: str | None,
    is_approved: bool,
) -> HuntItemAlias | None:
    alias = db.query(HuntItemAlias).filter(HuntItemAlias.id == alias_id).first()
    if not alias:
        return None

    cleaned_canonical = (canonical_name or "").strip()

    if cleaned_canonical:
        alias.canonical_name = cleaned_canonical
        alias.canonical_name_normalized = normalize_item_name(cleaned_canonical)
    else:
        alias.canonical_name = None
        alias.canonical_name_normalized = None

    alias.is_approved = bool(is_approved and cleaned_canonical)
    alias.updated_at = func.now()
    db.commit()
    db.refresh(alias)
    return alias


def upsert_manual_alias(
    db: Session,
    observed_name: str,
    canonical_name: str,
) -> HuntItemAlias | None:
    observed = (observed_name or "").strip()
    canonical = (canonical_name or "").strip()
    if not observed or not canonical:
        return None

    alias = register_observed_item(db, observed)
    if alias is None:
        return None

    alias.canonical_name = canonical
    alias.canonical_name_normalized = normalize_item_name(canonical)
    alias.is_approved = True
    alias.updated_at = func.now()
    db.commit()
    db.refresh(alias)
    return alias


def sync_aliases_for_canonical_name(
    db: Session,
    canonical_name: str,
    previous_canonical_name: str | None = None,
) -> int:
    cleaned_canonical = (canonical_name or "").strip()
    if not cleaned_canonical:
        return 0

    new_normalized = normalize_item_name(cleaned_canonical)
    old_normalized = normalize_item_name(previous_canonical_name or "") if previous_canonical_name else ""

    conditions = [HuntItemAlias.observed_name_normalized == new_normalized]
    if old_normalized:
        conditions.append(HuntItemAlias.canonical_name_normalized == old_normalized)
    else:
        conditions.append(HuntItemAlias.canonical_name_normalized == new_normalized)

    aliases = db.query(HuntItemAlias).filter(or_(*conditions)).all()
    updates = 0

    for alias in aliases:
        alias.canonical_name = cleaned_canonical
        alias.canonical_name_normalized = new_normalized
        alias.is_approved = True
        alias.updated_at = func.now()
        updates += 1

    db.flush()
    return updates


def get_related_alias_names(db: Session, canonical_name: str) -> list[str]:
    normalized_name = normalize_item_name(canonical_name)
    if not normalized_name:
        return []

    aliases = db.query(HuntItemAlias).filter(
        or_(
            HuntItemAlias.canonical_name_normalized == normalized_name,
            HuntItemAlias.observed_name_normalized == normalized_name,
        )
    ).all()

    names = {
        (alias.observed_name or "").strip()
        for alias in aliases
        if (alias.observed_name or "").strip()
    }

    return sorted(names)
