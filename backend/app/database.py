"""
KrishiMitra — Database Layer

Uses asyncpg directly for maximum performance.
Connection pool created on startup, closed on shutdown.
Schema DDL executed via init_db().
"""

import os
from dotenv import load_dotenv
load_dotenv()
import asyncpg
from typing import AsyncGenerator

# ---------------------------------------------------------------------------
# Module-level pool reference
# ---------------------------------------------------------------------------
pool: asyncpg.Pool | None = None

# ---------------------------------------------------------------------------
# Full database schema — executed once on startup
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
-- ================================================================
-- USERS — Google OAuth only, NO password column
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    google_sub   VARCHAR(128) UNIQUE,
    email        VARCHAR(255) UNIQUE NOT NULL,
    full_name    VARCHAR(255) NOT NULL,
    password_hash TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_login   TIMESTAMPTZ DEFAULT NOW(),
    is_active    BOOLEAN DEFAULT TRUE,
    lang_pref    VARCHAR(10) DEFAULT 'en',
    role         VARCHAR(20) DEFAULT 'farmer'
);

-- ================================================================
-- FARMS
-- ================================================================
CREATE TABLE IF NOT EXISTS farms (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    farm_name    VARCHAR(255) NOT NULL,
    location     VARCHAR(255),
    state        VARCHAR(100),
    district     VARCHAR(100),
    area_acres   FLOAT,
    soil_type    VARCHAR(100),
    latitude     FLOAT,
    longitude    FLOAT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CROPS
-- ================================================================
CREATE TABLE IF NOT EXISTS crops (
    id           SERIAL PRIMARY KEY,
    farm_id      INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    crop_name    VARCHAR(255) NOT NULL,
    variety      VARCHAR(255),
    sown_date    DATE,
    harvest_date DATE,
    area_acres   FLOAT,
    status       VARCHAR(50) DEFAULT 'growing'
);

-- ================================================================
-- DISEASE SCANS
-- ================================================================
CREATE TABLE IF NOT EXISTS disease_scans (
    id           SERIAL PRIMARY KEY,
    farm_id      INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id),
    image_url    TEXT,
    crop_name    VARCHAR(255),
    disease_name VARCHAR(255),
    confidence   FLOAT,
    severity     VARCHAR(50),
    treatment    TEXT,
    scanned_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- PEST SCANS
-- ================================================================
CREATE TABLE IF NOT EXISTS pest_scans (
    id            SERIAL PRIMARY KEY,
    farm_id       INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id),
    image_url     TEXT,
    pest_name     VARCHAR(255),
    infestation   VARCHAR(50),
    organic_ctrl  TEXT,
    chemical_ctrl TEXT,
    treatment     TEXT,
    scanned_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SOIL REPORTS
-- ================================================================
CREATE TABLE IF NOT EXISTS soil_reports (
    id                SERIAL PRIMARY KEY,
    farm_id           INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    ph_level          FLOAT,
    nitrogen          FLOAT,
    phosphorus        FLOAT,
    potassium         FLOAT,
    organic_matter    FLOAT,
    moisture          FLOAT,
    ec                FLOAT,
    temperature       FLOAT,
    soil_health_score FLOAT,
    recommended_crops TEXT[],
    fertilizer_advice TEXT,
    tested_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- YIELD PREDICTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS yield_predictions (
    id               SERIAL PRIMARY KEY,
    farm_id          INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    crop_name        VARCHAR(255),
    predicted_kg     FLOAT,
    confidence       FLOAT,
    area_acres       FLOAT,
    season           VARCHAR(50),
    improvement_tips TEXT,
    predicted_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- EXPENSES
-- ================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id           SERIAL PRIMARY KEY,
    farm_id      INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    category     VARCHAR(100),
    amount       FLOAT,
    description  TEXT,
    date         DATE DEFAULT CURRENT_DATE
);

-- ================================================================
-- SEASON SUMMARY
-- ================================================================
CREATE TABLE IF NOT EXISTS season_summary (
    id            SERIAL PRIMARY KEY,
    farm_id       INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    season        VARCHAR(50),
    year          INTEGER,
    total_expense FLOAT DEFAULT 0,
    total_revenue FLOAT DEFAULT 0,
    profit_loss   FLOAT DEFAULT 0,
    yield_kg      FLOAT DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (farm_id, season, year)
);

-- ================================================================
-- ALERTS
-- ================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id),
    farm_id      INTEGER REFERENCES farms(id),
    alert_type   VARCHAR(50),
    severity     VARCHAR(20) DEFAULT 'LOW',
    title        VARCHAR(255),
    message      TEXT,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CROP CALENDAR
-- ================================================================
CREATE TABLE IF NOT EXISTS crop_calendar (
    id            SERIAL PRIMARY KEY,
    farm_id       INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    task_name     VARCHAR(255),
    task_type     VARCHAR(100),
    scheduled_at  TIMESTAMPTZ,
    completed     BOOLEAN DEFAULT FALSE,
    urgency       VARCHAR(20) DEFAULT 'NORMAL',
    cost_estimate FLOAT DEFAULT 0
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_farms_user_id    ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_disease_farm     ON disease_scans(farm_id);
CREATE INDEX IF NOT EXISTS idx_pest_farm        ON pest_scans(farm_id);
CREATE INDEX IF NOT EXISTS idx_expenses_farm    ON expenses(farm_id);
CREATE INDEX IF NOT EXISTS idx_alerts_farm      ON alerts(farm_id);
CREATE INDEX IF NOT EXISTS idx_calendar_farm    ON crop_calendar(farm_id);
"""


async def init_db() -> None:
    """Create the connection pool and execute schema DDL."""
    global pool
    dsn = os.getenv("DATABASE_URL", "postgresql://agriuser:agripass@postgres:5432/agridb")
    if dsn.startswith("postgres://"):
        dsn = dsn.replace("postgres://", "postgresql://", 1)
    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,   # Render free tier: 1 instance, no need for >1 idle connections
        max_size=5,   # Neon serverless: keep low to avoid connection limit errors
        command_timeout=30,
        max_inactive_connection_lifetime=300,  # recycle idle connections every 5 min
    )

    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
        # Ensure the unique constraint on season_summary exists in case table was created previously without it
        try:
            await conn.execute("ALTER TABLE season_summary ADD CONSTRAINT season_summary_farm_id_season_year_key UNIQUE (farm_id, season, year)")
        except Exception:
            pass
        # Ensure treatment column exists on pest_scans table
        try:
            await conn.execute("ALTER TABLE pest_scans ADD COLUMN IF NOT EXISTS treatment TEXT")
        except Exception:
            pass
        # Make google_sub nullable for email/password users
        try:
            await conn.execute("ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL")
        except Exception:
            pass
        # Ensure password_hash column exists
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
        except Exception:
            pass
        # Ensure latitude/longitude on farms for geolocation-based weather
        try:
            await conn.execute("ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude FLOAT")
            await conn.execute("ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude FLOAT")
        except Exception:
            pass

    print("[OK] Database initialized - 12 tables, 8 indexes")


async def close_db() -> None:
    """Gracefully close the connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None
        print("[Closed] Database connection pool closed")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency — yields a single connection from the pool."""
    if pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    async with pool.acquire() as conn:
        yield conn
