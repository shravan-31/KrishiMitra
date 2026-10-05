"""
KrishiMitra — Google OAuth 2.0 Authentication Router

Endpoints:
  GET  /auth/google/login     → Redirect to Google consent screen
  GET  /auth/google/callback  → Exchange code, upsert user, set JWT cookie
  GET  /auth/me               → Return current user from cookie
  POST /auth/logout            → Clear cookie

Zero passwords. Google-only. JWT in httpOnly cookie.
"""

import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import re

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwt
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from app.database import get_db


# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_me_in_production_minimum_32_characters_long")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ═══════════════════════════════════════════════════════════════════════════
# Schemas & Helper Functions for Email/Password Auth
# ═══════════════════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    pwd_bytes = password.encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

def create_jwt_response(user_row, status_code=200):
    payload = {
        "sub": str(user_row["id"]),
        "email": user_row["email"],
        "name": user_row["full_name"],
        "picture": user_row.get("avatar_url") or "",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    content = {
        "id": user_row["id"],
        "email": user_row["email"],
        "full_name": user_row["full_name"],
        "avatar_url": user_row.get("avatar_url") or "",
        "created_at": user_row["created_at"].isoformat() if hasattr(user_row["created_at"], "isoformat") else str(user_row["created_at"]),
        "last_login": user_row["last_login"].isoformat() if hasattr(user_row["last_login"], "isoformat") else str(user_row["last_login"]),
        "role": user_row.get("role", "farmer"),
        "lang_pref": user_row.get("lang_pref", "en")
    }
    
    response = JSONResponse(content=content, status_code=status_code)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=604800,  # 7 days
        secure=False,
    )
    return response


# ═══════════════════════════════════════════════════════════════════════════
# DEVELOPER BYPASS ENDPOINT: GET /auth/dev-login
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/dev-login")
async def dev_login(db=Depends(get_db)):
    """Mock/Developer login endpoint for local environments when Google OAuth is not configured."""
    # Check if a mock user exists
    user = await db.fetchrow(
        "SELECT id, email, full_name, avatar_url FROM users WHERE google_sub = $1",
        "mock_dev_user"
    )
    if not user:
        user = await db.fetchrow(
            """
            INSERT INTO users (google_sub, email, full_name, avatar_url, created_at, last_login)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, email, full_name, avatar_url
            """,
            "mock_dev_user",
            "farmer@krishimitra.org",
            "Krishi Dev Farmer",
            "https://api.dicebear.com/7.x/adventurer/svg?seed=KrishiDev",
        )

    # Create JWT
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["full_name"],
        "picture": user["avatar_url"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    # Redirect relative to current host so it works locally and through tunnels
    response = RedirectResponse("/dashboard")
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=604800,  # 7 days
        secure=False,
    )
    return response


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 1: GET /auth/google/login
# Redirects browser to Google OAuth consent screen
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/google/login")
async def google_login():
    """Build Google OAuth URL and redirect user to consent screen."""
    client_id = os.getenv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID)
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", GOOGLE_REDIRECT_URI)
    if not client_id:
        raise HTTPException(
            status_code=500,
            detail="Google Client ID is not configured in .env. Please configure GOOGLE_CLIENT_ID.",
        )
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(google_auth_url)


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 2: GET /auth/google/callback?code=xxx
# Exchanges auth code → tokens → upserts user → sets JWT cookie
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/google/callback")
async def google_callback(code: str, db=Depends(get_db)):
    """
    Google OAuth callback handler.

    Step A: Exchange authorization code for Google tokens.
    Step B: Verify the id_token to extract user info.
    Step C: Upsert user in database (handles BOTH signup + signin).
    Step D: Create a JWT access token.
    Step E: Set httpOnly cookie and redirect to dashboard.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID)
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET)
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", GOOGLE_REDIRECT_URI)

    # ── Step A: Exchange code for tokens ──────────────────────────────────
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to exchange code for tokens: {token_response.text}",
        )

    tokens = token_response.json()

    if "id_token" not in tokens:
        raise HTTPException(
            status_code=400,
            detail="No id_token in Google response",
        )

    # ── Step B: Verify id_token ───────────────────────────────────────────
    try:
        guser = google_id_token.verify_oauth2_token(
            tokens["id_token"],
            google_requests.Request(),
            client_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Google token: {e}",
        )

    sub = guser["sub"]
    email = guser["email"]
    name = guser.get("name", email.split("@")[0])
    picture = guser.get("picture", "")

    # ── Step C: Upsert user (signup + signin, handling existing accounts) ──
    existing_user = await db.fetchrow(
        "SELECT id, email, full_name, avatar_url, created_at, last_login FROM users WHERE google_sub = $1 OR email = $2",
        sub, email
    )
    if existing_user:
        user = await db.fetchrow(
            """
            UPDATE users SET
                google_sub = COALESCE(google_sub, $1),
                full_name = COALESCE($2, full_name),
                avatar_url = COALESCE($3, avatar_url),
                last_login = NOW()
            WHERE id = $4
            RETURNING id, email, full_name, avatar_url, created_at, last_login
            """,
            sub, name, picture, existing_user["id"]
        )
    else:
        user = await db.fetchrow(
            """
            INSERT INTO users (google_sub, email, full_name, avatar_url, created_at, last_login)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, email, full_name, avatar_url, created_at, last_login
            """,
            sub, email, name, picture
        )

    # ── Step D: Create JWT ────────────────────────────────────────────────
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["full_name"],
        "picture": user["avatar_url"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    # ── Step E: Set cookie and redirect to dashboard ──────────────────────
    response = RedirectResponse(FRONTEND_URL + "/dashboard")
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=604800,  # 7 days
        secure=False,    # True in production with HTTPS
    )
    return response


# ═══════════════════════════════════════════════════════════════════════════
# Reusable Dependency: get_current_user
# ═══════════════════════════════════════════════════════════════════════════
async def get_current_user(request: Request, db=Depends(get_db)):
    """Extract and verify JWT from cookie, and fetch user details from DB."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired — please log in again",
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )

    user = await db.fetchrow(
        "SELECT id, email, full_name, avatar_url, created_at, last_login, role, lang_pref "
        "FROM users WHERE id = $1",
        int(payload["sub"]),
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return dict(user)


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 3: GET /auth/me
# Returns current user info from JWT cookie
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    """Return the currently authenticated user."""
    return user


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 4: POST /auth/logout
# Clears the access_token cookie
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/logout")
async def logout():
    """Clear the JWT cookie and log the user out."""
    response = JSONResponse(content={"ok": True})
    response.delete_cookie("access_token")
    return response


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 5: POST /auth/register
# Accepts email, password, full_name and registers a user, setting a JWT cookie
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/register")
async def register(req: RegisterRequest, db=Depends(get_db)):
    """Register a new user with email and password, setting a JWT cookie."""
    # Validation
    email_clean = req.email.strip().lower()
    if not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    if not req.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    
    # Check if email is already taken
    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", email_clean)
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    # Hash password and create user
    hashed = hash_password(req.password)
    avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={req.full_name.replace(' ', '')}"
    
    try:
        user = await db.fetchrow(
            """
            INSERT INTO users (google_sub, email, full_name, password_hash, avatar_url, created_at, last_login)
            VALUES (NULL, $1, $2, $3, $4, NOW(), NOW())
            RETURNING id, email, full_name, avatar_url, created_at, last_login, role, lang_pref
            """,
            email_clean,
            req.full_name.strip(),
            hashed,
            avatar_url
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")
        
    return create_jwt_response(user, status_code=201)


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINT 6: POST /auth/login
# Accepts email, password, verifies credentials, setting a JWT cookie
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/login")
async def login(req: LoginRequest, db=Depends(get_db)):
    """Authenticate email and password, setting a JWT cookie."""
    email_clean = req.email.strip().lower()
    user = await db.fetchrow(
        """
        SELECT id, email, full_name, password_hash, avatar_url, created_at, last_login, role, lang_pref
        FROM users
        WHERE email = $1
        """,
        email_clean
    )
    
    if not user or not user["password_hash"] or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    # Update last_login
    await db.execute("UPDATE users SET last_login = NOW() WHERE id = $1", user["id"])
    
    # Fetch updated user row to return
    updated_user = await db.fetchrow(
        """
        SELECT id, email, full_name, avatar_url, created_at, last_login, role, lang_pref
        FROM users
        WHERE id = $1
        """,
        user["id"]
    )
    
    return create_jwt_response(updated_user, status_code=200)

