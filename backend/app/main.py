"""
KrishiMitra — FastAPI Application Entry Point

Lifespan: init_db ↔ close_db + ML model preload
CORS: Production-safe origin whitelist
WebSocket: ConnectionManager with heartbeat ping
Sentry: Error monitoring integrated
Health: GET /health
"""

import json
import os
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager
from typing import Dict, Set, Optional, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, close_db

# ---------------------------------------------------------------------------
# Sentry Error Monitoring (Fix 4)
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.asyncio import AsyncioIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration(), AsyncioIntegration()],
        traces_sample_rate=0.1,      # 10% performance traces
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("GIT_COMMIT", "unknown"),
    )
    print("[Sentry] Error monitoring active")
else:
    print("[Sentry] SENTRY_DSN not set — skipping error monitoring")


# ---------------------------------------------------------------------------
# WebSocket Connection Manager (imported from app.websocket to avoid circular imports)
# ---------------------------------------------------------------------------
from app.websocket import ConnectionManager, ws_manager, get_ws_manager


# ---------------------------------------------------------------------------
# Lifespan — DB init + ML model preload on startup (Fix 6)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB pool + preload ML models. Shutdown: close pool."""
    # 1. Database
    await init_db()

    # 2. Preload ML models to eliminate cold-start lag on first request (Fix 6)
    try:
        from app.ml.disease import load_disease_model
        load_disease_model()
        print("[ML] Disease model preloaded ✓")
    except Exception as e:
        print(f"[ML] Disease model preload failed: {e}")

    try:
        from app.ml.pest import load_pest_model
        load_pest_model()
        print("[ML] Pest model preloaded ✓")
    except Exception as e:
        print(f"[ML] Pest model preload failed (non-critical): {e}")

    try:
        from app.ml.soil import load_soil_model
        load_soil_model()
        print("[ML] Soil model preloaded ✓")
    except Exception as e:
        print(f"[ML] Soil model preload failed (non-critical): {e}")

    try:
        from app.ml.yield_pred import load_yield_model
        load_yield_model()
        print("[ML] Yield model preloaded ✓")
    except Exception as e:
        print(f"[ML] Yield model preload failed (non-critical): {e}")

    print("[Start] KrishiMitra backend started — all models ready")
    yield

    await close_db()
    print("[Stop] KrishiMitra backend stopped")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="KrishiMitra API",
    description="Smart Agriculture Intelligence Platform — 14 features, ML-powered",
    version="1.0.1",
    lifespan=lifespan,
)

# ---- CORS (Fix 5) — Production-safe whitelist ----
_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
_backend_url  = os.getenv("BACKEND_URL",  "http://localhost:8000")

# Build explicit allowed origins — no wildcard regex in production
_allowed_origins = [
    _frontend_url,
    _backend_url,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Remove duplicates and empty strings
_allowed_origins = list(set(o for o in _allowed_origins if o))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,      # explicit list, no wildcard
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
)


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["System"])
async def health_check():
    """System health probe — returns status and active WS connections."""
    return {
        "status": "ok",
        "version": app.version,
        "ws_connections": ws_manager.active_connections_count(),
    }


# ---------------------------------------------------------------------------
# WebSocket Endpoint with Farm Ownership Auth + Heartbeat Ping (Fix 8)
# ---------------------------------------------------------------------------
import asyncio
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
    """Per-farm WebSocket room with auth + server-side heartbeat ping every 25s."""
    user_id = await get_ws_user_id(ws)
    await ws_manager.connect(ws, farm_id)

    # Heartbeat task — ping every 25s to keep Render connection alive (Fix 8)
    async def heartbeat():
        while True:
            await asyncio.sleep(25)
            try:
                await ws.send_json({"event_type": "ping", "payload": {}})
            except Exception:
                break

    ping_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await ws.receive_text()
            if data == "pong":
                continue  # client responding to our ping — ignore
            await ws_manager.broadcast(farm_id, {"echo": data})
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        ws_manager.disconnect(ws, farm_id)

@app.websocket("/ws/farm/{farm_id}")
async def websocket_endpoint_farm(ws: WebSocket, farm_id: int):
    """Alias for /ws/{farm_id}."""
    await websocket_endpoint(ws, farm_id)


# ---------------------------------------------------------------------------
# Router Includes & Static Files
# ---------------------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import settings

uploads_path = os.path.abspath(settings.upload_dir)
os.makedirs(os.path.join(uploads_path, "disease"), exist_ok=True)
os.makedirs(os.path.join(uploads_path, "pest"), exist_ok=True)

FALLBACK_SCAN_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'
    '<rect width="160" height="160" rx="16" fill="#1e293b"/>'
    '<circle cx="80" cy="80" r="48" fill="#334155"/>'
    '<path d="M80 50 C65 50 55 65 55 80 C55 95 68 108 80 110 C92 108 105 95 105 80 C105 65 95 50 80 50 Z" fill="#10b981" opacity="0.8"/>'
    '<path d="M80 54 L80 106" stroke="#064e3b" stroke-width="3" stroke-linecap="round"/>'
    '<text x="80" y="132" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" text-anchor="middle">AgriMind Scan</text>'
    '</svg>'
)

class FallbackStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            resp = await super().get_response(path, scope)
            if resp.status_code == 404:
                return Response(
                    content=FALLBACK_SCAN_SVG,
                    media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            return resp
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return Response(
                    content=FALLBACK_SCAN_SVG,
                    media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            raise exc
        except Exception:
            return Response(
                content=FALLBACK_SCAN_SVG,
                media_type="image/svg+xml",
                headers={"Cache-Control": "public, max-age=3600"}
            )

app.mount("/static/uploads", FallbackStaticFiles(directory=uploads_path), name="static_uploads")

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
from app.routers.chat import (
    router as chat_router,
    legacy_router as chat_legacy_router,
    chatbot_router,
    v1_chatbot_router,
    chat_page_router,
    chatbot_page_router
)
from app.routers.schemes import router as schemes_router
from app.routers.health import router as health_router
from app.routers.language import router as language_router
from app.routers.crop_health import router as crop_health_router
from app.routers.drought import router as drought_router

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
app.include_router(calendar_router, prefix="/api")
app.include_router(calendar_router, prefix="/api/v1")
app.include_router(season_summary_router)
app.include_router(weather_router)
app.include_router(chat_router)
app.include_router(chat_legacy_router)
app.include_router(chatbot_router)
app.include_router(v1_chatbot_router)
app.include_router(chat_page_router)
app.include_router(chatbot_page_router)
app.include_router(schemes_router)
app.include_router(health_router)
app.include_router(language_router)
app.include_router(crop_health_router)
app.include_router(drought_router)


# ---------------------------------------------------------------------------
# Serve React Frontend SPA / Fallback Pages
# ---------------------------------------------------------------------------
from fastapi.responses import FileResponse, HTMLResponse
from app.routers.chat import CHATBOT_HTML_PAGE

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="frontend_assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Specific friendly fallback for direct chat URLs
        if full_path in ("chat", "chatbot", "ai-chat"):
            file_path = os.path.join(frontend_dist, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            # If SPA index.html exists, return it; otherwise return standalone Chatbot HTML
            if os.path.exists(os.path.join(frontend_dist, "index.html")):
                return FileResponse(os.path.join(frontend_dist, "index.html"))
            return HTMLResponse(content=CHATBOT_HTML_PAGE, status_code=200)

        if full_path.startswith(("api", "auth", "static", "ws", "health", "docs", "openapi.json", "redoc")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")

        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def serve_root_fallback():
        return {
            "status": "online",
            "app": "AgriMind (KrishiMitra) API",
            "message": "Backend API is live and operational!",
            "documentation": "/docs",
            "health": "/health",
            "chatbot_ui": "/chat",
            "chatbot_api": "/api/v1/chat/message"
        }

    @app.get("/{full_path:path}")
    async def serve_fallback_paths(full_path: str):
        if full_path in ("chat", "chatbot", "ai-chat"):
            return HTMLResponse(content=CHATBOT_HTML_PAGE, status_code=200)
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
