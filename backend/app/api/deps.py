from jose import JWTError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.tokens import decode_access_token, is_token_invalid
from app.db.session import get_db
from app.models.sidebar_menu import SidebarMenuSetting
from app.models.user import User

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        payload = decode_access_token(token)

        if is_token_invalid(payload, "access"):
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()

    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return user


def require_enabled_menu(menu_key: str):
    normalized_key = str(menu_key or "").strip().lower()

    def _check_menu_enabled(db: Session = Depends(get_db)) -> None:
        menu_item = (
            db.query(SidebarMenuSetting)
            .filter(SidebarMenuSetting.menu_key == normalized_key)
            .first()
        )

        if menu_item and not menu_item.is_enabled:
            raise HTTPException(status_code=403, detail="Página bloqueada pelo admin")

    return _check_menu_enabled