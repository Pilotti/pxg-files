from __future__ import annotations

import json
from pathlib import Path


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "ocr_settings.json"


def _ensure_store() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text('{"debug_ocr_enabled": false}', encoding="utf-8")


def _read_store() -> dict:
    _ensure_store()
    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8") or "{}")
        if not isinstance(raw, dict):
            return {"debug_ocr_enabled": False}
        return raw
    except Exception:
        return {"debug_ocr_enabled": False}


def is_ocr_debug_enabled() -> bool:
    store = _read_store()
    return bool(store.get("debug_ocr_enabled", False))


def set_ocr_debug_enabled(enabled: bool) -> bool:
    store = _read_store()
    store["debug_ocr_enabled"] = bool(enabled)
    DATA_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    return bool(store["debug_ocr_enabled"])
