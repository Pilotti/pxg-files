from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import (
    clear_login_attempts,
    ensure_login_not_rate_limited,
    record_failed_login_attempt,
)
from app.core.security import hash_password, verify_password, hash_token
from app.core.tokens import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    is_token_invalid,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LogoutRequest, RefreshRequest
from app.schemas.token import TokenResponse
from app.schemas.user import UserLogin, UserPreferencesUpdate, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _login_rate_limit_key(request: Request, identifier: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{identifier.strip().lower()}"


@router.post("/register", response_model=UserResponse)
def register_user(data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    new_user = User(
        display_name=data.display_name.strip(),
        email=data.email,
        password_hash=hash_password(data.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=TokenResponse)
def login_user(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    rate_limit_key = _login_rate_limit_key(request, data.email)
    ensure_login_not_rate_limited(rate_limit_key)

    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        record_failed_login_attempt(rate_limit_key)
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    clear_login_attempts(rate_limit_key)

    access_token = create_access_token(str(user.id))
    refresh_token, expires_at = create_refresh_token(str(user.id))

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=expires_at,
    )

    db.add(refresh_token_record)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_user_token(data: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_refresh_token(data.refresh_token)

        if is_token_invalid(payload, "refresh"):
            raise HTTPException(status_code=401, detail="Refresh token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    token_hash = hash_token(data.refresh_token)

    token_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )

    if not token_record:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado")

    if token_record.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token revogado")

    if token_record.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expirado")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()

    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    access_token = create_access_token(str(user.id))
    new_refresh_token, expires_at = create_refresh_token(str(user.id))

    token_record.revoked_at = datetime.now(timezone.utc)

    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh_token),
        expires_at=expires_at,
    )

    db.add(new_token_record)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout")
def logout_user(data: LogoutRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(data.refresh_token)

    token_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )

    if token_record and token_record.revoked_at is None:
        token_record.revoked_at = datetime.now(timezone.utc)
        db.commit()

    return {"detail": "Logout realizado com sucesso"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/preferences", response_model=UserResponse)
def update_user_preferences(
    payload: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.preferred_language = payload.preferred_language
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
