from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


ALGORITHM = "HS256"


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.refresh_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "type": "refresh",
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_refresh_secret_key, algorithm=ALGORITHM)
    return token, expire


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])


def decode_refresh_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=[ALGORITHM])


def is_token_invalid(payload: dict, expected_type: str) -> bool:
    token_type = payload.get("type")
    subject = payload.get("sub")
    return token_type != expected_type or subject is None