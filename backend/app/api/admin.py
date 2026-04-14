import json
import json
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.admin_security import (
    create_admin_token,
    decode_admin_token,
    verify_admin_credentials,
)
from app.core.config import settings
from app.db.session import get_db
from app.models.tasks import (
    CharacterQuest,
    CharacterTask,
    QuestTemplate,
    TaskTemplate,
)
from app.models.character import Character
from app.models.hunt_session import HuntSession
from app.models.refresh_token import RefreshToken
from app.models.sidebar_menu import SidebarMenuSetting
from app.models.user import User
from app.schemas.admin import (
    AdminHuntItemAliasCreateRequest,
    AdminHuntItemAliasResponse,
    AdminHuntItemAliasUpdateRequest,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminMeResponse,
    AdminUserListItem,
    AdminNpcPriceResponse,
    AdminNpcPriceListResponse,
    AdminNpcPriceUpdateRequest,
    AdminNpcPriceCreateRequest,
    AdminQuestCreateRequest,
    AdminQuestUpdateRequest,
    AdminTaskCreateRequest,
    AdminTaskUpdateRequest,
        AdminPokemonEntry,
        AdminPokemonListResponse,
        AdminPokemonCreateRequest,
        AdminPokemonUpdateRequest,
        AdminSidebarMenuSettingResponse,
        AdminSidebarMenuSettingUpdateRequest,
)
from app.schemas.tasks import ActionResponse, QuestCatalogResponse, TaskCatalogListResponse, TaskCatalogResponse
from app.services.hunt_item_aliases import (
    get_related_alias_names,
    list_hunt_item_aliases,
    sync_aliases_for_canonical_name,
    upsert_manual_alias,
    update_hunt_item_alias,
)
from app.schemas.admin import (
    AdminConsumableResponse,
    AdminConsumableListResponse,
    AdminConsumableCreateRequest,
    AdminConsumableUpdateRequest,
    AdminOcrReviewItem,
    AdminOcrReviewListResponse,
    AdminOcrReviewUpdateRequest,
)
from app.services.consumables import (
    create_consumable,
    delete_consumable,
    has_consumable,
    list_consumable_categories,
    list_consumables as list_consumables_service,
    update_consumable,
)
from app.services.hunt_npc_prices import has_npc_price_item, list_npc_prices, update_npc_price
from app.services.task_json_storage import export_task_templates_to_json_files
from app.services.quest_json_storage import export_quest_templates_to_json_files

router = APIRouter(prefix="/admin", tags=["admin"])


def normalize_task_types(value) -> list[str]:
    import json
    
    # Se já é lista, normaliza
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    
    if value is None:
        return []
    
    # Se é string, tenta parsear como JSON
    text = str(value).strip()
    if text.startswith('[') and text.endswith(']'):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Se não for array JSON, trata como string simples
    return [text] if text else []


def normalize_continent_value(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized == "nightmare":
        return "nightmare_world"
    return normalized


def get_current_admin(authorization: str | None = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token admin ausente",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de autorização inválido",
        )

    token = authorization.replace("Bearer ", "", 1).strip()
    return decode_admin_token(token)
@router.post("/login", response_model=AdminLoginResponse)
def admin_login(data: AdminLoginRequest):
    if not verify_admin_credentials(data.username.strip(), data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais admin inválidas",
        )

    token = create_admin_token()
    return AdminLoginResponse(access_token=token)


@router.get("/me", response_model=AdminMeResponse)
def admin_me(current_admin: dict = Depends(get_current_admin)):
    return AdminMeResponse(username=current_admin["sub"])


@router.get("/users", response_model=list[AdminUserListItem])
def admin_list_users(
    search: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if search:
        normalized_search = f"%{search.strip()}%"
        query = query.filter(
            User.display_name.ilike(normalized_search) | User.email.ilike(normalized_search)
        )

    items = query.order_by(User.id.asc()).limit(limit).all()

    return [
        AdminUserListItem(
            id=item.id,
            username=(item.display_name or "").strip() or item.email,
            email=item.email,
        )
        for item in items
    ]


@router.delete("/users/{user_id}", response_model=ActionResponse)
def admin_delete_user(
    user_id: int,
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    character_ids = [item.id for item in db.query(Character.id).filter(Character.user_id == user_id).all()]

    if character_ids:
        db.query(CharacterTask).filter(CharacterTask.character_id.in_(character_ids)).delete(synchronize_session=False)
        db.query(CharacterQuest).filter(CharacterQuest.character_id.in_(character_ids)).delete(synchronize_session=False)

    db.query(HuntSession).filter(HuntSession.user_id == user_id).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(synchronize_session=False)
    db.query(Character).filter(Character.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()

    return ActionResponse(detail="Usuário removido com sucesso")


@router.get("/tasks", response_model=TaskCatalogListResponse)
def admin_list_tasks(
    search: str | None = Query(None),
    task_type: str | None = Query(None),
    continent: str | None = Query(None),
    city: str | None = Query(None),
    nw_level: int | None = Query(None, ge=1, le=999),
    min_level: int | None = Query(None, ge=0, le=625),
    max_level: int | None = Query(None, ge=0, le=625),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    query = db.query(TaskTemplate)

    if search:
        query = query.filter(TaskTemplate.name.ilike(f"%{search.strip()}%"))

    if task_type:
        query = query.filter(
            TaskTemplate.task_type.contains(f'"{task_type}"')
        )

    normalized_continent = normalize_continent_value(continent)
    if normalized_continent:
        query = query.filter(TaskTemplate.continent == normalized_continent)

    if city:
        query = query.filter(TaskTemplate.city.ilike(city.strip()))

    if nw_level is not None:
        query = query.filter(TaskTemplate.nw_level == nw_level)

    if min_level is not None:
        query = query.filter(TaskTemplate.min_level >= min_level)

    if max_level is not None:
        query = query.filter(TaskTemplate.min_level <= max_level)

    if is_active is not None:
        query = query.filter(TaskTemplate.is_active.is_(is_active))

    total = query.count()
    offset = (page - 1) * page_size
    items = (
        query
        .order_by(TaskTemplate.min_level.asc(), TaskTemplate.name.asc(), TaskTemplate.id.asc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    total_pages = max(1, (total + page_size - 1) // page_size)

    return TaskCatalogListResponse(
        items=[
            TaskCatalogResponse(
                id=item.id,
                name=item.name,
                description=item.description,
                task_type=normalize_task_types(item.task_type),
                continent=item.continent,
                min_level=item.min_level,
                nw_level=item.nw_level,
                reward_text=item.reward_text,
                npc_name=item.npc_name,
                coordinate=item.coordinate,
                city=item.city,
                is_active=item.is_active,
                status="available",
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/tasks", response_model=TaskCatalogResponse)
def admin_create_task(
    data: AdminTaskCreateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    normalized_name = data.name.strip()
    normalized_description = data.description.strip() if data.description else None
    normalized_reward = data.reward_text.strip() if data.reward_text else None
    normalized_npc = normalized_name
    normalized_coordinate = data.coordinate.strip() if data.coordinate else None
    normalized_city = data.city.strip()

    item = TaskTemplate(
        name=normalized_name,
        description=normalized_description,
        task_type=data.task_type,
        continent=data.continent,
        min_level=data.min_level,
        nw_level=data.nw_level,
        reward_text=normalized_reward,
        npc_name=normalized_npc,
        coordinate=normalized_coordinate,
        city=normalized_city,
        is_active=data.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    export_task_templates_to_json_files(db)

    return TaskCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        task_type=normalize_task_types(item.task_type),
        continent=item.continent,
        min_level=item.min_level,
        nw_level=item.nw_level,
        reward_text=item.reward_text,
        npc_name=item.npc_name,
        coordinate=item.coordinate,
        city=item.city,
        is_active=item.is_active,
        status="available",
    )


@router.put("/tasks/{task_id}", response_model=TaskCatalogResponse)
def admin_update_task(
    task_id: int,
    data: AdminTaskUpdateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(TaskTemplate).filter(TaskTemplate.id == task_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Task não encontrada")

    item.name = data.name.strip()
    item.description = data.description.strip() if data.description else None
    item.task_type = data.task_type
    item.continent = data.continent
    item.min_level = data.min_level
    item.nw_level = data.nw_level
    item.reward_text = data.reward_text.strip() if data.reward_text else None
    item.npc_name = data.name.strip()
    item.coordinate = data.coordinate.strip() if data.coordinate else None
    item.city = data.city.strip()
    item.is_active = data.is_active

    db.commit()
    db.refresh(item)
    export_task_templates_to_json_files(db)

    return TaskCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        task_type=normalize_task_types(item.task_type),
        continent=item.continent,
        min_level=item.min_level,
        nw_level=item.nw_level,
        reward_text=item.reward_text,
        npc_name=item.npc_name,
        coordinate=item.coordinate,
        city=item.city,
        is_active=item.is_active,
        status="available",
    )


@router.patch("/tasks/{task_id}/toggle-active", response_model=ActionResponse)
def admin_toggle_task_active(
    task_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(TaskTemplate).filter(TaskTemplate.id == task_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Task não encontrada")

    item.is_active = not item.is_active
    db.commit()
    export_task_templates_to_json_files(db)

    return ActionResponse(
        detail="Task ativada com sucesso" if item.is_active else "Task desativada com sucesso"
    )


@router.delete("/tasks/{task_id}", response_model=ActionResponse)
def admin_delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(TaskTemplate).filter(TaskTemplate.id == task_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Task não encontrada")

    db.query(CharacterTask).filter(CharacterTask.task_template_id == task_id).delete(
        synchronize_session=False
    )
    db.delete(item)
    db.commit()
    export_task_templates_to_json_files(db)

    return ActionResponse(
        detail="Task removida permanentemente do sistema e das listas dos personagens"
    )


@router.get("/quests", response_model=list[QuestCatalogResponse])
def admin_list_quests(
    search: str | None = Query(None),
    continent: str | None = Query(None),
    city: str | None = Query(None),
    nw_level: int | None = Query(None, ge=1, le=999),
    min_level: int | None = Query(None, ge=0, le=625),
    max_level: int | None = Query(None, ge=0, le=625),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    query = db.query(QuestTemplate)

    if search:
        query = query.filter(QuestTemplate.name.ilike(f"%{search.strip()}%"))

    normalized_continent = normalize_continent_value(continent)
    if normalized_continent:
        query = query.filter(QuestTemplate.continent == normalized_continent)

    if city:
        query = query.filter(QuestTemplate.city.ilike(city.strip()))

    if nw_level is not None:
        query = query.filter(QuestTemplate.nw_level == nw_level)

    if min_level is not None:
        query = query.filter(QuestTemplate.min_level >= min_level)

    if max_level is not None:
        query = query.filter(QuestTemplate.min_level <= max_level)

    if is_active is not None:
        query = query.filter(QuestTemplate.is_active.is_(is_active))

    items = query.order_by(QuestTemplate.min_level.asc(), QuestTemplate.name.asc()).all()

    return [
        QuestCatalogResponse(
            id=item.id,
            name=item.name,
            description=item.description,
            continent=item.continent,
            city=item.city,
            min_level=item.min_level,
            nw_level=item.nw_level,
            reward_text=item.reward_text,
            is_active=item.is_active,
            status="available",
        )
        for item in items
    ]


@router.post("/quests", response_model=QuestCatalogResponse)
def admin_create_quest(
    data: AdminQuestCreateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = QuestTemplate(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        continent=data.continent,
        city=data.city.strip() if data.city else None,
        min_level=data.min_level,
        nw_level=data.nw_level,
        reward_text=data.reward_text.strip() if data.reward_text else None,
        is_active=data.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    export_quest_templates_to_json_files(db)

    return QuestCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        continent=item.continent,
        city=item.city,
        min_level=item.min_level,
        nw_level=item.nw_level,
        reward_text=item.reward_text,
        is_active=item.is_active,
        status="available",
    )


@router.put("/quests/{quest_id}", response_model=QuestCatalogResponse)
def admin_update_quest(
    quest_id: int,
    data: AdminQuestUpdateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(QuestTemplate).filter(QuestTemplate.id == quest_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    item.name = data.name.strip()
    item.description = data.description.strip() if data.description else None
    item.continent = data.continent
    item.city = data.city.strip() if data.city else None
    item.min_level = data.min_level
    item.nw_level = data.nw_level
    item.reward_text = data.reward_text.strip() if data.reward_text else None
    item.is_active = data.is_active

    db.commit()
    db.refresh(item)
    export_quest_templates_to_json_files(db)

    return QuestCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        continent=item.continent,
        city=item.city,
        min_level=item.min_level,
        nw_level=item.nw_level,
        reward_text=item.reward_text,
        is_active=item.is_active,
        status="available",
    )


@router.patch("/quests/{quest_id}/toggle-active", response_model=ActionResponse)
def admin_toggle_quest_active(
    quest_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(QuestTemplate).filter(QuestTemplate.id == quest_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    item.is_active = not item.is_active
    db.commit()
    export_quest_templates_to_json_files(db)

    return ActionResponse(
        detail="Quest ativada com sucesso" if item.is_active else "Quest desativada com sucesso"
    )


@router.delete("/quests/{quest_id}", response_model=ActionResponse)
def admin_delete_quest(
    quest_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = db.query(QuestTemplate).filter(QuestTemplate.id == quest_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    db.query(CharacterQuest).filter(CharacterQuest.quest_template_id == quest_id).delete(
        synchronize_session=False
    )
    db.delete(item)
    db.commit()
    export_quest_templates_to_json_files(db)

    return ActionResponse(
        detail="Quest removida permanentemente do sistema e das listas dos personagens"
    )


@router.get("/hunt-item-aliases", response_model=list[AdminHuntItemAliasResponse])
def admin_list_hunt_item_aliases(
    search: str | None = Query(None),
    status: str = Query("pending", pattern="^(pending|approved|all)$"),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    items = list_hunt_item_aliases(db, search=search, status=status)
    return [
        AdminHuntItemAliasResponse(
            id=item.id,
            observed_name=item.observed_name,
            observed_name_normalized=item.observed_name_normalized,
            canonical_name=item.canonical_name,
            canonical_name_normalized=item.canonical_name_normalized,
            is_approved=item.is_approved,
            occurrences=item.occurrences,
            last_seen_at=item.last_seen_at,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.patch("/hunt-item-aliases/{alias_id}", response_model=AdminHuntItemAliasResponse)
def admin_update_hunt_item_alias(
    alias_id: int,
    payload: AdminHuntItemAliasUpdateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    # When approving, canonical_name must exist in the known NPC price items.
    if payload.is_approved and payload.canonical_name:
        if not has_npc_price_item(payload.canonical_name):
            raise HTTPException(
                status_code=422,
                detail=f"Nome canônico '{payload.canonical_name}' não encontrado na lista de itens NPC.",
            )

    updated = update_hunt_item_alias(
        db,
        alias_id=alias_id,
        canonical_name=payload.canonical_name,
        is_approved=payload.is_approved,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Alias de item não encontrado")

    return AdminHuntItemAliasResponse(
        id=updated.id,
        observed_name=updated.observed_name,
        observed_name_normalized=updated.observed_name_normalized,
        canonical_name=updated.canonical_name,
        canonical_name_normalized=updated.canonical_name_normalized,
        is_approved=updated.is_approved,
        occurrences=updated.occurrences,
        last_seen_at=updated.last_seen_at,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


@router.post("/hunt-item-aliases/manual", response_model=AdminHuntItemAliasResponse)
def admin_create_manual_hunt_item_alias(
    payload: AdminHuntItemAliasCreateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    created = upsert_manual_alias(
        db,
        observed_name=payload.observed_name,
        canonical_name=payload.canonical_name,
    )

    if not created:
        raise HTTPException(status_code=400, detail="Nao foi possivel salvar alias manual")

    return AdminHuntItemAliasResponse(
        id=created.id,
        observed_name=created.observed_name,
        observed_name_normalized=created.observed_name_normalized,
        canonical_name=created.canonical_name,
        canonical_name_normalized=created.canonical_name_normalized,
        is_approved=created.is_approved,
        occurrences=created.occurrences,
        last_seen_at=created.last_seen_at,
        created_at=created.created_at,
        updated_at=created.updated_at,
    )


@router.get("/hunt-npc-prices/names", response_model=list[str])
def admin_list_hunt_npc_price_names(
    _: dict = Depends(get_current_admin),
):
    """Return all known item names from hunts_npc_prices.json as a plain list."""
    items = list_npc_prices()
    return sorted(str(item["name"]) for item in items)


@router.get("/hunt-npc-prices", response_model=AdminNpcPriceListResponse)
def admin_list_hunt_npc_prices(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    items = list_npc_prices(search=search)
    total = len(items)
    offset = (page - 1) * page_size
    paged_items = items[offset: offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return AdminNpcPriceListResponse(
        items=[
            AdminNpcPriceResponse(
                **item,
                related_aliases=get_related_alias_names(db, str(item["name"])),
            )
            for item in paged_items
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.put("/hunt-npc-prices", response_model=AdminNpcPriceResponse)
def admin_update_hunt_npc_price(
    payload: AdminNpcPriceUpdateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    updated = update_npc_price(
        previous_name=payload.previous_name,
        new_name=payload.name,
        unit_price=payload.unit_price,
    )
    sync_aliases_for_canonical_name(
        db,
        canonical_name=str(updated["name"]),
        previous_canonical_name=payload.previous_name,
    )
    db.commit()
    return AdminNpcPriceResponse(
        **updated,
        related_aliases=get_related_alias_names(db, str(updated["name"])),
    )


@router.post("/hunt-npc-prices", response_model=AdminNpcPriceResponse, status_code=201)
def admin_create_hunt_npc_price(
    payload: AdminNpcPriceCreateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    """Create a new NPC price item. Raises 409 if the name already exists."""
    from app.services.hunt_npc_prices import has_npc_price_item
    if has_npc_price_item(payload.name):
        raise HTTPException(
            status_code=409,
            detail=f"Item '{payload.name}' já existe na tabela de preços NPC.",
        )
    created = update_npc_price(
        previous_name="",
        new_name=payload.name,
        unit_price=payload.unit_price,
    )
    db.commit()
    return AdminNpcPriceResponse(
        **created,
        related_aliases=[],
    )


@router.get("/consumables", response_model=AdminConsumableListResponse)
def admin_list_consumables(
    search: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_admin),
):
    items = list_consumables_service(search=search, category=category)
    total = len(items)
    offset = (page - 1) * page_size
    paged = items[offset: offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)
    return AdminConsumableListResponse(
        items=[AdminConsumableResponse(**item) for item in paged],
        available_categories=list_consumable_categories(),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/consumables", response_model=AdminConsumableResponse, status_code=201)
def admin_create_consumable(
    payload: AdminConsumableCreateRequest,
    _: dict = Depends(get_current_admin),
):
    if has_consumable(payload.nome):
        raise HTTPException(status_code=409, detail=f"Consumível '{payload.nome}' já existe.")
    created = create_consumable(payload.nome, payload.preco_npc, payload.categoria)
    return AdminConsumableResponse(**created)


@router.put("/consumables", response_model=AdminConsumableResponse)
def admin_update_consumable(
    payload: AdminConsumableUpdateRequest,
    _: dict = Depends(get_current_admin),
):
    try:
        updated = update_consumable(payload.previous_nome, payload.nome, payload.preco_npc, payload.categoria)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return AdminConsumableResponse(**updated)


@router.delete("/consumables/{nome}", status_code=204)
def admin_delete_consumable(
    nome: str,
    _: dict = Depends(get_current_admin),
):
    try:
        delete_consumable(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sidebar-menus", response_model=list[AdminSidebarMenuSettingResponse])
def admin_list_sidebar_menus(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    items = (
        db.query(SidebarMenuSetting)
        .order_by(SidebarMenuSetting.sort_order.asc(), SidebarMenuSetting.id.asc())
        .all()
    )

    return [
        AdminSidebarMenuSettingResponse(
            menu_key=item.menu_key,
            label=item.label,
            path=item.path,
            sort_order=item.sort_order,
            is_enabled=item.is_enabled,
            is_beta=item.is_beta,
        )
        for item in items
    ]


@router.put("/sidebar-menus/{menu_key}", response_model=AdminSidebarMenuSettingResponse)
def admin_update_sidebar_menu(
    menu_key: str,
    data: AdminSidebarMenuSettingUpdateRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    item = (
        db.query(SidebarMenuSetting)
        .filter(SidebarMenuSetting.menu_key == menu_key.strip().lower())
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Menu não encontrado")

    item.is_enabled = data.is_enabled
    item.is_beta = data.is_beta
    db.commit()
    db.refresh(item)

    return AdminSidebarMenuSettingResponse(
        menu_key=item.menu_key,
        label=item.label,
        path=item.path,
        sort_order=item.sort_order,
        is_enabled=item.is_enabled,
        is_beta=item.is_beta,
    )


_INIMIGOS_PATH = Path(__file__).parent.parent / "data" / "inimigos.json"
_POKEMON_RE = re.compile(r"^(\d{4}) - (.+)$")


def _load_inimigos() -> list[str]:
    with open(_INIMIGOS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return [entry["nome"] for entry in data]


def _save_inimigos(names: list[str]) -> None:
    with open(_INIMIGOS_PATH, "w", encoding="utf-8") as f:
        json.dump([{"nome": n} for n in names], f, ensure_ascii=False, indent=2)


def _parse_entry(nome: str) -> AdminPokemonEntry:
    m = _POKEMON_RE.match(nome)
    if m:
        return AdminPokemonEntry(dex_id=m.group(1), name=m.group(2), full_name=nome)
    return AdminPokemonEntry(dex_id="", name=nome, full_name=nome)


@router.get("/pokemon", response_model=AdminPokemonListResponse)
def admin_list_pokemon(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    _: dict = Depends(get_current_admin),
):
    names = _load_inimigos()
    if search:
        term = search.strip().lower()
        names = [n for n in names if term in n.lower()]

    total = len(names)
    offset = (page - 1) * page_size
    paged_names = names[offset: offset + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return AdminPokemonListResponse(
        items=[_parse_entry(n) for n in paged_names],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/pokemon", response_model=AdminPokemonEntry, status_code=201)
def admin_create_pokemon(
    data: AdminPokemonCreateRequest,
    _: dict = Depends(get_current_admin),
):
    dex_id = data.dex_id.strip()
    name = data.name.strip()
    full_name = f"{dex_id} - {name}"
    names = _load_inimigos()
    if any(n.lower() == full_name.lower() for n in names):
        raise HTTPException(status_code=409, detail="Pokémon já existe na lista.")
    names.append(full_name)
    _save_inimigos(names)
    return _parse_entry(full_name)


@router.put("/pokemon", response_model=AdminPokemonEntry)
def admin_update_pokemon(
    data: AdminPokemonUpdateRequest,
    _: dict = Depends(get_current_admin),
):
    names = _load_inimigos()
    original = data.original_full_name.strip()
    idx = next((i for i, n in enumerate(names) if n == original), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Pokémon não encontrado.")
    new_full = f"{data.dex_id.strip()} - {data.name.strip()}"
    if new_full != original and any(n.lower() == new_full.lower() for n in names):
        raise HTTPException(status_code=409, detail="Já existe um Pokémon com esse nome.")
    names[idx] = new_full
    _save_inimigos(names)
    return _parse_entry(new_full)


@router.delete("/pokemon", response_model=ActionResponse)
def admin_delete_pokemon(
    full_name: str = Query(..., min_length=1),
    _: dict = Depends(get_current_admin),
):
    names = _load_inimigos()
    before = len(names)
    names = [n for n in names if n != full_name]
    if len(names) == before:
        raise HTTPException(status_code=404, detail="Pokémon não encontrado.")
    _save_inimigos(names)
    return ActionResponse(detail="Pokémon removido da lista.")


def _get_ocr_review_dir() -> Path:
    review_dir = Path(settings.ocr_review_dir)
    review_dir.mkdir(parents=True, exist_ok=True)
    return review_dir


def _get_ocr_review_index_path() -> Path:
    return _get_ocr_review_dir() / "index.json"


def _load_ocr_review_index() -> dict:
    index_path = _get_ocr_review_index_path()
    if not index_path.exists():
        return {}
    try:
        return json.loads(index_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_ocr_review_index(data: dict) -> None:
    index_path = _get_ocr_review_index_path()
    index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("/ocr-review", response_model=AdminOcrReviewListResponse)
def admin_list_ocr_review(_: dict = Depends(get_current_admin)):
    review_dir = _get_ocr_review_dir()
    index = _load_ocr_review_index()
    items: list[AdminOcrReviewItem] = []
    for file_path in sorted(review_dir.glob("*"), key=lambda item: item.stat().st_mtime, reverse=True):
        if not file_path.is_file():
            continue
        if file_path.name == "index.json":
            continue
        stat = file_path.stat()
        meta = index.get(file_path.name, {})
        items.append(
            AdminOcrReviewItem(
                filename=file_path.name,
                size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime),
                status=str(meta.get("status") or "pending"),
                notes=meta.get("notes"),
            )
        )
    return AdminOcrReviewListResponse(items=items, total=len(items))


@router.get("/ocr-review/{filename}")
def admin_get_ocr_review_file(
    filename: str,
    _: dict = Depends(get_current_admin),
):
    review_dir = _get_ocr_review_dir()
    safe_name = Path(filename).name
    file_path = (review_dir / safe_name).resolve()
    if review_dir not in file_path.parents:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    return FileResponse(file_path)


@router.put("/ocr-review/{filename}")
def admin_update_ocr_review(
    filename: str,
    payload: AdminOcrReviewUpdateRequest,
    _: dict = Depends(get_current_admin),
):
    review_dir = _get_ocr_review_dir()
    safe_name = Path(filename).name
    file_path = (review_dir / safe_name).resolve()
    if review_dir not in file_path.parents:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    normalized_status = payload.status.strip().lower()
    if normalized_status not in {"pending", "approved", "ignored"}:
        raise HTTPException(status_code=400, detail="Status inválido.")

    index = _load_ocr_review_index()
    index[safe_name] = {
        "status": normalized_status,
        "notes": payload.notes.strip() if payload.notes else None,
        "updated_at": datetime.utcnow().isoformat(),
    }
    _save_ocr_review_index(index)
    return {"ok": True}
