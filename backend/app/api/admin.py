from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
import json
import re
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.admin_security import (
    create_admin_token,
    decode_admin_token,
    verify_admin_credentials,
)
from app.db.session import get_db
from app.models.tasks import (
    CharacterQuest,
    CharacterTask,
    QuestTemplate,
    TaskTemplate,
)
from app.models.sidebar_menu import SidebarMenuSetting
from app.schemas.admin import (
    AdminHuntItemAliasResponse,
    AdminHuntItemAliasUpdateRequest,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminMeResponse,
    AdminOcrDebugFileResponse,
    AdminOcrDebugSettingsResponse,
    AdminOcrDebugSettingsUpdateRequest,
    AdminOcrDebugSessionResponse,
    AdminOcrDebugTextPreviewResponse,
    AdminNpcPriceResponse,
    AdminNpcPriceUpdateRequest,
    AdminQuestCreateRequest,
    AdminQuestUpdateRequest,
    AdminTaskCreateRequest,
    AdminTaskUpdateRequest,
        AdminPokemonEntry,
        AdminPokemonCreateRequest,
        AdminPokemonUpdateRequest,
        AdminSidebarMenuSettingResponse,
        AdminSidebarMenuSettingUpdateRequest,
)
from app.schemas.tasks import ActionResponse, QuestCatalogResponse, TaskCatalogResponse
from app.services.hunt_item_aliases import (
    get_related_alias_names,
    list_hunt_item_aliases,
    sync_aliases_for_canonical_name,
    update_hunt_item_alias,
)
from app.services.hunt_npc_prices import list_npc_prices, update_npc_price
from app.services.ocr_debug_logs import (
    get_ocr_debug_file_path,
    list_ocr_debug_files,
    list_ocr_debug_sessions,
    read_ocr_debug_text,
)
from app.services.ocr_debug_settings import is_ocr_debug_enabled, set_ocr_debug_enabled

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


@router.get("/ocr-debug", response_model=AdminOcrDebugSettingsResponse)
def admin_get_ocr_debug_settings(_: dict = Depends(get_current_admin)):
    return AdminOcrDebugSettingsResponse(debug_ocr_enabled=is_ocr_debug_enabled())


@router.put("/ocr-debug", response_model=AdminOcrDebugSettingsResponse)
def admin_update_ocr_debug_settings(
    data: AdminOcrDebugSettingsUpdateRequest,
    _: dict = Depends(get_current_admin),
):
    enabled = set_ocr_debug_enabled(data.debug_ocr_enabled)
    return AdminOcrDebugSettingsResponse(debug_ocr_enabled=enabled)


@router.get("/ocr-debug/sessions", response_model=list[AdminOcrDebugSessionResponse])
def admin_list_ocr_debug_sessions(
    limit: int = Query(40, ge=1, le=200),
    _: dict = Depends(get_current_admin),
):
    return [AdminOcrDebugSessionResponse(**item) for item in list_ocr_debug_sessions(limit=limit)]


@router.get("/ocr-debug/sessions/{session_id}/files", response_model=list[AdminOcrDebugFileResponse])
def admin_list_ocr_debug_files(
    session_id: str,
    _: dict = Depends(get_current_admin),
):
    try:
        items = list_ocr_debug_files(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return [AdminOcrDebugFileResponse(**item) for item in items]


@router.get(
    "/ocr-debug/sessions/{session_id}/text/{file_name:path}",
    response_model=AdminOcrDebugTextPreviewResponse,
)
def admin_read_ocr_debug_text(
    session_id: str,
    file_name: str,
    _: dict = Depends(get_current_admin),
):
    try:
        content = read_ocr_debug_text(session_id=session_id, file_name=file_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AdminOcrDebugTextPreviewResponse(file_name=file_name, content=content)


@router.get("/ocr-debug/sessions/{session_id}/download/{file_name:path}")
def admin_download_ocr_debug_file(
    session_id: str,
    file_name: str,
    _: dict = Depends(get_current_admin),
):
    try:
        path = get_ocr_debug_file_path(session_id=session_id, file_name=file_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return FileResponse(path=str(path), filename=path.name)


@router.get("/tasks", response_model=list[TaskCatalogResponse])
def admin_list_tasks(
    search: str | None = Query(None),
    task_type: str | None = Query(None),
    continent: str | None = Query(None),
    city: str | None = Query(None),
    nw_level: int | None = Query(None, ge=1, le=999),
    min_level: int | None = Query(None, ge=0, le=625),
    max_level: int | None = Query(None, ge=0, le=625),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    query = db.query(TaskTemplate)

    if search:
        query = query.filter(TaskTemplate.name.ilike(f"%{search.strip()}%"))

    if task_type:
        query = query.filter(
            (TaskTemplate.task_type.astext.contains(f'"{task_type}"'))
            | (TaskTemplate.task_type == task_type)
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

    items = query.order_by(TaskTemplate.min_level.asc(), TaskTemplate.name.asc()).all()

    return [
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
    ]


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
    normalized_coordinate = data.coordinate.strip()
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
    item.coordinate = data.coordinate.strip()
    item.city = data.city.strip()
    item.is_active = data.is_active

    db.commit()
    db.refresh(item)

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

    return ActionResponse(
        detail="Task removida permanentemente do sistema e das listas dos personagens"
    )


@router.get("/quests", response_model=list[QuestCatalogResponse])
def admin_list_quests(
    search: str | None = Query(None),
    continent: str | None = Query(None),
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
        min_level=data.min_level,
        nw_level=data.nw_level,
        reward_text=data.reward_text.strip() if data.reward_text else None,
        is_active=data.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return QuestCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        continent=item.continent,
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
    item.min_level = data.min_level
    item.nw_level = data.nw_level
    item.reward_text = data.reward_text.strip() if data.reward_text else None
    item.is_active = data.is_active

    db.commit()
    db.refresh(item)

    return QuestCatalogResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        continent=item.continent,
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


@router.get("/hunt-npc-prices", response_model=list[AdminNpcPriceResponse])
def admin_list_hunt_npc_prices(
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    items = list_npc_prices(search=search)
    return [
        AdminNpcPriceResponse(
            **item,
            related_aliases=get_related_alias_names(db, str(item["name"])),
        )
        for item in items
    ]


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


@router.get("/pokemon", response_model=list[AdminPokemonEntry])
def admin_list_pokemon(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_admin),
):
    names = _load_inimigos()
    if search:
        term = search.strip().lower()
        names = [n for n in names if term in n.lower()]
    return [_parse_entry(n) for n in names[:limit]]


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


