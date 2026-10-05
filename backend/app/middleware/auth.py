"""
KrishiMitra — Authentication Middleware

Cookie-based JWT authentication.
Google OAuth only — NO passwords.
"""

import os

from fastapi import Depends, HTTPException, Request, status
from jose import ExpiredSignatureError, JWTError, jwt

from app.database import get_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_me_in_production_minimum_32_characters_long")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


# ---------------------------------------------------------------------------
# FastAPI Dependency — get current user from httpOnly cookie
# ---------------------------------------------------------------------------
async def get_current_user(request: Request, db=Depends(get_db)):
    """
    Extract and validate the current user from the httpOnly JWT cookie.

    Returns:
        asyncpg.Record — full user row from the database.

    Raises:
        HTTPException 401 — if no cookie, expired token, or invalid token.
        HTTPException 404 — if user not found in database.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login required",
        )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired — please log in again",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
        )

    user = await db.fetchrow(
        "SELECT * FROM users WHERE id = $1",
        int(user_id),
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user
