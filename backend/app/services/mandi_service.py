"""
KrishiMitra — Mandi Service
Integrates directly with Data.gov.in / AGMARKNET API for real market prices.
Handles parsing, normalization, timeouts, and data freshness metadata.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
import pandas as pd
from app.config import settings

logger = logging.getLogger("mandi_service")

# Default AGMARKNET resource on Data.gov.in
DEFAULT_RESOURCE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "market", "mandi_prices.csv")


def _normalize_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a Data.gov.in AGMARKNET record across varying case keys.
    """
    # Helper to fetch case-insensitively
    def get_val(keys: List[str], default=None):
        for k in keys:
            for rk, rv in raw.items():
                if rk.lower() == k.lower():
                    return rv
        return default

    state = str(get_val(["state", "State"], "Maharashtra"))
    district = str(get_val(["district", "District"], "Pune"))
    market = str(get_val(["market", "Market"], "APMC Mandi"))
    commodity = str(get_val(["commodity", "Commodity"], ""))
    variety = str(get_val(["variety", "Variety"], "Standard"))
    arrival_date = str(get_val(["arrival_date", "Arrival_Date"], ""))

    def parse_float(val, fallback=0.0):
        try:
            return float(str(val).replace(",", "").strip())
        except (ValueError, TypeError):
            return fallback

    min_price = parse_float(get_val(["min_price", "Min_Price", "Min Price"], 0.0))
    max_price = parse_float(get_val(["max_price", "Max_Price", "Max Price"], 0.0))
    modal_price = parse_float(get_val(["modal_price", "Modal_Price", "Modal Price"], 0.0))

    if modal_price == 0.0 and (min_price > 0 or max_price > 0):
        modal_price = (min_price + max_price) / 2.0

    return {
        "state": state,
        "district": district,
        "market": market,
        "commodity": commodity,
        "variety": variety,
        "arrival_date": arrival_date,
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "modal_price": round(modal_price, 2),
    }


def _get_archive_prices(commodity: str) -> List[Dict[str, Any]]:
    """
    Deterministic historical APMC prices from curated dataset if live API is unavailable.
    Clearly marked as archive data, not live.
    """
    if os.path.exists(CSV_PATH):
        try:
            df = pd.read_csv(CSV_PATH)
            crop_clean = commodity.strip().capitalize()
            crop_df = df[df["crop"].str.capitalize() == crop_clean].sort_values("date")
            if not crop_df.empty:
                last_record = crop_df.iloc[-1]
                modal = round(float(last_record["modal_price"]), 2)
                date_str = str(last_record["date"])
                return [
                    {
                        "state": "Maharashtra",
                        "district": "Pune",
                        "market": "Pune Mandi",
                        "commodity": crop_clean,
                        "variety": "Common",
                        "arrival_date": date_str,
                        "min_price": round(modal * 0.95, 2),
                        "max_price": round(modal * 1.05, 2),
                        "modal_price": modal,
                        "source": "Historical local dataset (mandi_prices.csv)",
                    }
                ]
        except Exception as e:
            logger.warning(f"Failed to read archive mandi CSV: {e}")

    return []


async def fetch_mandi_prices(
    commodity: str,
    state: Optional[str] = "Maharashtra",
    district: Optional[str] = None,
    market: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Fetches genuine APMC records from Data.gov.in.
    Returns normalized market records with strict provenance and freshness metadata.
    """
    api_key = settings.data_gov_in_api_key
    endpoint = settings.data_gov_in_endpoint or DEFAULT_RESOURCE_URL
    fetched_at = datetime.now(timezone.utc).isoformat()
    today_str = datetime.now().strftime("%d/%m/%Y")

    if not api_key:
        logger.warning("DATA_GOV_IN_API_KEY is not configured; using local historical dataset.")
        archive_records = _get_archive_prices(commodity)
        return {
            "source": "Historical local dataset (mandi_prices.csv)",
            "is_live": False,
            "status_label": "Historical local dataset record (API Key Not Configured)",
            "fetched_at": fetched_at,
            "records": archive_records,
            "total_records": len(archive_records),
            "error": "DATA_GOV_IN_API_KEY missing",
        }

    params = {
        "api-key": api_key,
        "format": "json",
        "limit": str(limit),
        "filters[commodity]": commodity.strip().capitalize(),
    }
    if state:
        params["filters[state]"] = state.strip()
    if district:
        params["filters[district]"] = district.strip()
    if market:
        params["filters[market]"] = market.strip()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(endpoint, params=params)

            if response.status_code == 429:
                logger.warning("Data.gov.in rate limit exceeded (429).")
                archive_records = _get_archive_prices(commodity)
                return {
                    "source": "Data.gov.in (Rate Limited - Showing Archive)",
                    "is_live": False,
                    "status_label": "Latest available APMC record (Rate Limited)",
                    "fetched_at": fetched_at,
                    "records": archive_records,
                    "total_records": len(archive_records),
                    "error": "Rate limit exceeded on Data.gov.in",
                }

            if response.status_code != 200:
                logger.warning(f"Data.gov.in returned HTTP {response.status_code}: {response.text[:200]}")
                archive_records = _get_archive_prices(commodity)
                return {
                    "source": f"Data.gov.in (HTTP {response.status_code})",
                    "is_live": False,
                    "status_label": "Latest available APMC record",
                    "fetched_at": fetched_at,
                    "records": archive_records,
                    "total_records": len(archive_records),
                    "error": f"Provider HTTP {response.status_code}",
                }

            data = response.json()
            raw_records = data.get("records", [])

            if not raw_records:
                # Try relaxed filter without state if no records found
                if "filters[state]" in params:
                    params.pop("filters[state]")
                    res_relaxed = await client.get(endpoint, params=params)
                    if res_relaxed.status_code == 200:
                        raw_records = res_relaxed.json().get("records", [])

            normalized: List[Dict[str, Any]] = []
            for r in raw_records:
                norm = _normalize_record(r)
                if norm["commodity"].lower() == commodity.strip().lower() or not norm["commodity"]:
                    normalized.append(norm)

            if not normalized:
                # No live records for this specific commodity currently in APMC registry
                archive_records = _get_archive_prices(commodity)
                return {
                    "source": "Data.gov.in",
                    "is_live": False,
                    "status_label": "Latest available APMC record (No recent mandi arrival)",
                    "fetched_at": fetched_at,
                    "records": archive_records,
                    "total_records": len(archive_records),
                    "message": f"No APMC records found for commodity '{commodity}' in current arrival batch.",
                }

            # Check arrival date freshness: is newest arrival from today?
            first_arrival = normalized[0]["arrival_date"]
            is_today = (first_arrival == today_str) or (first_arrival == datetime.now().strftime("%Y-%m-%d"))

            return {
                "source": "data.gov.in",
                "is_live": is_today,
                "status_label": "Live APMC Price Today" if is_today else "Latest available APMC record",
                "fetched_at": fetched_at,
                "record_date": first_arrival,
                "records": normalized,
                "total_records": len(normalized),
            }

    except httpx.TimeoutException:
        logger.warning("Data.gov.in request timed out after 10s.")
        archive_records = _get_archive_prices(commodity)
        return {
            "source": "Data.gov.in (Timeout - Archive Fallback)",
            "is_live": False,
            "status_label": "Latest available APMC record",
            "fetched_at": fetched_at,
            "records": archive_records,
            "total_records": len(archive_records),
            "error": "Connection to Data.gov.in timed out",
        }
    except Exception as ex:
        logger.error(f"Error fetching from Data.gov.in: {ex}")
        archive_records = _get_archive_prices(commodity)
        return {
            "source": "Data.gov.in (Error - Archive Fallback)",
            "is_live": False,
            "status_label": "Latest available APMC record",
            "fetched_at": fetched_at,
            "records": archive_records,
            "total_records": len(archive_records),
            "error": str(ex),
        }
