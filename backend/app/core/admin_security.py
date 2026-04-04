import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import HTTPException, status

from app.core.config import settings


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def verify_admin_credentials(username: str, password: str) -> bool:
    return hmac.compare_digest(username, settings.admin_username) and hmac.compare_digest(
        password, settings.admin_password
    )


def create_admin_token() -> str:
    payload = {
        "sub": settings.admin_username,
        "role": "admin",
        "exp": int(time.time()) + settings.admin_token_ttl_seconds,
    }

    payload_bytes = json.dumps(payload, separators=(",", ":")).encode()
    payload_part = _b64encode(payload_bytes)

    signature = hmac.new(
        settings.admin_secret_key.encode(),
        payload_part.encode(),
        hashlib.sha256,
    ).digest()

    signature_part = _b64encode(signature)

    return f"{payload_part}.{signature_part}"


def decode_admin_token(token: str) -> dict[str, Any]:
    try:
        payload_part, signature_part = token.split(".")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token admin inválido",
        )

    expected_signature = hmac.new(
        settings.admin_secret_key.encode(),
        payload_part.encode(),
        hashlib.sha256,
    ).digest()

    received_signature = _b64decode(signature_part)

    if not hmac.compare_digest(expected_signature, received_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token admin inválido",
        )

    payload = json.loads(_b64decode(payload_part).decode())

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token admin inválido",
        )

    if int(time.time()) >= int(payload.get("exp", 0)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão admin expirada",
        )

    return payload