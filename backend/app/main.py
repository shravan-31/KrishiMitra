"""
KrishiMitra — FastAPI Application Entry Point

Lifespan: init_db ↔ close_db
CORS: allows FRONTEND_URL with credentials
WebSocket: ConnectionManager for real-time farm alerts
Health: GET /health
"""

import json
import os
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, close_db


# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Manages WebSocket connections grouped by farm_id rooms."""

    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, farm_id: int) -> None:
        """Accept a WebSocket and add it to the farm's room."""
        await ws.accept()
        if farm_id not in self.rooms:
            self.rooms[farm_id] = set()
        self.rooms[farm_id].add(ws)

    def disconnect(self, ws: WebSocket, farm_id: int) -> None:
        """Remove a WebSocket from the farm's room."""
        if farm_id in self.rooms:
            self.rooms[farm_id].discard(ws)
            if not self.rooms[farm_id]:
                del self.rooms[farm_id]

    async def broadcast(self, farm_id: int, data: dict) -> None:
        """Send a JSON message to all connections in a farm room."""
        if farm_id not in self.rooms:
            return
        message = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self.rooms[farm_id]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[farm_id].discard(ws)

    async def broadcast_all(self, data: dict) -> None:
        """Send a JSON message to every connected client across all rooms."""
        message = json.dumps(data)
        for farm_id in list(self.rooms.keys()):
            dead: list[WebSocket] = []
            for ws in self.rooms[farm_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.rooms[farm_id].discard(ws)


# Singleton manager — importable from other modules
ws_manager = ConnectionManager()

def get_ws_manager():
    return ws_manager


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB pool + schema. Shutdown: close pool."""
    await init_db()
    print("[Start] KrishiMitra backend started")
    yield
    await close_db()
    print("[Stop] KrishiMitra backend stopped")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KrishiMitra API",
    description="Smart Agriculture Intelligence Platform — 14 features, ML-powered",
    version="0.1.0",
    lifespan=lifespan,
)

# ---- CORS ----
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000", "http://localhost:80", "http://localhost:5173"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["System"])
async def health_check():
    """System health probe — returns phase and status."""
    return {"status": "ok", "phase": "1-auth"}


# ---------------------------------------------------------------------------
# WebSocket Endpoint with Farm Ownership Authorization (Fix 15)
# ---------------------------------------------------------------------------
from starlette.status import WS_1008_POLICY_VIOLATION, WS_1011_INTERNAL_ERROR
from jose import jwt, JWTError

async def get_ws_user_id(ws: WebSocket) -> Optional[int]:
    """Extract authenticated user_id from httpOnly cookie or fallback query token."""
    token = ws.cookies.get("access_token") or ws.query_params.get("token")
    if not token:
        return None
    try:
        from app.config import settings
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        return int(sub) if sub else None
    except Exception:
        return None

@app.websocket("/ws/{farm_id}")
async def websocket_endpoint(ws: WebSocket, farm_id: int):
    """Per-farm WebSocket room for real-time alerts with farmer ownership authorization."""
    user_id = await get_ws_user_id(ws)
    if user_id is None:
        await ws.close(code=WS_1008_POLICY_VIOLATION, reason="Authentication required")
        return

    import app.database as db_module
    if db_module.pool:
        try:
            async with db_module.pool.acquire() as conn:
                farm = await conn.fetchrow("SELECT user_id FROM farms WHERE id = $1", farm_id)
                if not farm or farm["user_id"] != user_id:
                    await ws.close(code=WS_1008_POLICY_VIOLATION, reason="Unauthorized: You do not own this farm room")
                    return
        except Exception as e:
            await ws.close(code=WS_1011_INTERNAL_ERROR, reason=f"Authorization check failed: {e}")
            return

    await ws_manager.connect(ws, farm_id)
    try:
        while True:
            data = await ws.receive_text()
            await ws_manager.broadcast(farm_id, {"echo": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, farm_id)

@app.websocket("/ws/farm/{farm_id}")
async def websocket_endpoint_farm(ws: WebSocket, farm_id: int):
    """Alias for /ws/{farm_id} to match frontend hook pattern."""
    await websocket_endpoint(ws, farm_id)



# ---------------------------------------------------------------------------
# Router Includes & Static Files
# ---------------------------------------------------------------------------
from fastapi.staticfiles import StaticFiles

# Resolve and create uploads path
uploads_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "uploads"))
os.makedirs(os.path.join(uploads_path, "disease"), exist_ok=True)
os.makedirs(os.path.join(uploads_path, "pest"), exist_ok=True)

# Mount static uploads
app.mount("/static/uploads", StaticFiles(directory=uploads_path), name="static_uploads")

# Include Routers
from app.routers.auth import router as auth_router
from app.routers.farm import router as farm_router
from app.routers.crops import router as crops_router
from app.routers.disease import router as disease_router
from app.routers.pest import router as pest_router
from app.routers.soil import router as soil_router
from app.routers.yield_pred import router as yield_router
from app.routers.market import router as market_router
from app.routers.expenses import router as expenses_router
from app.routers.alerts import router as alerts_router
from app.routers.calendar import router as calendar_router
from app.routers.season_summary import router as season_summary_router
from app.routers.weather import router as weather_router
from app.routers.chat import router as chat_router
from app.routers.schemes import router as schemes_router
from app.routers.health import router as health_router
from app.routers.language import router as language_router
from app.routers.crop_health import router as crop_health_router

app.include_router(auth_router)
app.include_router(farm_router)
app.include_router(crops_router)
app.include_router(disease_router)
app.include_router(pest_router)
app.include_router(soil_router)
app.include_router(yield_router)
app.include_router(market_router)
app.include_router(expenses_router)
app.include_router(alerts_router)
app.include_router(calendar_router)
app.include_router(season_summary_router)
app.include_router(weather_router)
app.include_router(chat_router)
app.include_router(schemes_router)
app.include_router(health_router)
app.include_router(language_router)
app.include_router(crop_health_router)


# ---------------------------------------------------------------------------
# Serve React Frontend SPA (Single Service / Single Domain Deployment)
# ---------------------------------------------------------------------------
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="frontend_assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Exclude API, Auth, WS, Swagger docs and static uploads from SPA catch-all
        if full_path.startswith(("api", "auth", "static", "ws", "health", "docs", "openapi.json", "redoc")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

