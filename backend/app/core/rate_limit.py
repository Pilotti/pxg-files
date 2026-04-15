from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, status


_attempts: dict[str, Deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _prune(now: float, window_seconds: int) -> None:
    empty_keys = []
    for key, timestamps in _attempts.items():
        while timestamps and now - timestamps[0] > window_seconds:
            timestamps.popleft()
        if not timestamps:
            empty_keys.append(key)

    for key in empty_keys:
        _attempts.pop(key, None)


def ensure_login_not_rate_limited(
    key: str,
    *,
    max_attempts: int = 8,
    window_seconds: int = 15 * 60,
) -> None:
    now = time.monotonic()
    with _lock:
        _prune(now, window_seconds)
        attempts = _attempts[key]
        if len(attempts) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas de login. Tente novamente em alguns minutos.",
            )


def record_failed_login_attempt(
    key: str,
    *,
    window_seconds: int = 15 * 60,
) -> None:
    now = time.monotonic()
    with _lock:
        _prune(now, window_seconds)
        _attempts[key].append(now)


def clear_login_attempts(key: str) -> None:
    with _lock:
        _attempts.pop(key, None)
