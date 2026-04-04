from __future__ import annotations

from datetime import datetime
from pathlib import Path


DEBUG_ROOT = Path(__file__).resolve().parent.parent / "data" / "ocr_debug"
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_TEXT_EXTENSIONS = {".txt", ".log"}


def _ensure_root() -> None:
    DEBUG_ROOT.mkdir(parents=True, exist_ok=True)


def _session_dir(session_id: str) -> Path:
    normalized = Path(session_id).name
    target = (DEBUG_ROOT / normalized).resolve()

    if not str(target).startswith(str(DEBUG_ROOT.resolve())):
        raise ValueError("Sessao de debug invalida")

    if not target.exists() or not target.is_dir():
        raise FileNotFoundError("Sessao de debug nao encontrada")

    return target


def _file_path(session_id: str, file_name: str) -> Path:
    session = _session_dir(session_id)
    relative = Path(str(file_name).replace("\\", "/"))
    target = (session / relative).resolve()

    if not str(target).startswith(str(session.resolve())):
        raise ValueError("Arquivo de debug invalido")

    if not target.exists() or not target.is_file():
        raise FileNotFoundError("Arquivo de debug nao encontrado")

    return target


def _detect_kind(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in _IMAGE_EXTENSIONS:
        return "image"
    if suffix in _TEXT_EXTENSIONS:
        return "text"
    return "other"


def list_ocr_debug_sessions(limit: int = 40) -> list[dict]:
    _ensure_root()
    sessions: list[dict] = []

    for path in DEBUG_ROOT.iterdir():
        if not path.is_dir():
            continue

        files = [item for item in path.rglob("*") if item.is_file()]
        stats = path.stat()

        sessions.append(
            {
                "session_id": path.name,
                "created_at": datetime.fromtimestamp(stats.st_mtime),
                "file_count": len(files),
            }
        )

    sessions.sort(key=lambda item: item["created_at"], reverse=True)
    return sessions[: max(1, limit)]


def list_ocr_debug_files(session_id: str) -> list[dict]:
    session = _session_dir(session_id)
    files: list[dict] = []

    for path in session.rglob("*"):
        if not path.is_file():
            continue

        stats = path.stat()
        relative_name = path.relative_to(session).as_posix()
        files.append(
            {
                "name": relative_name,
                "kind": _detect_kind(path),
                "size_bytes": int(stats.st_size),
                "modified_at": datetime.fromtimestamp(stats.st_mtime),
            }
        )

    files.sort(key=lambda item: item["modified_at"], reverse=True)
    return files


def read_ocr_debug_text(session_id: str, file_name: str, max_chars: int = 12000) -> str:
    path = _file_path(session_id, file_name)
    if _detect_kind(path) != "text":
        raise ValueError("Arquivo nao e texto")

    content = path.read_text(encoding="utf-8", errors="replace")
    return content[: max(200, max_chars)]


def get_ocr_debug_file_path(session_id: str, file_name: str) -> Path:
    return _file_path(session_id, file_name)
