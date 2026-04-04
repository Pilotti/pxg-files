from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.sidebar_menu import SidebarMenuSetting
from app.models.user import User
from app.schemas.admin import AdminSidebarMenuSettingResponse

router = APIRouter(prefix="/ui", tags=["ui"])


@router.get("/sidebar-menus", response_model=list[AdminSidebarMenuSettingResponse])
def get_sidebar_menus(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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