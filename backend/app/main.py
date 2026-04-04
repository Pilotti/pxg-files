from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.characters import router as characters_router
from app.api.tasks import router as tasks_router
from app.api.quests import router as quests_router
from app.api.admin import router as admin_router
from app.api.hunts import router as hunts_router
from app.api.ui import router as ui_router
from app.db.init_db import init_db

app = FastAPI(title="PXG Files API")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(characters_router)
app.include_router(tasks_router)
app.include_router(quests_router)
app.include_router(admin_router)
app.include_router(hunts_router)
app.include_router(ui_router)
