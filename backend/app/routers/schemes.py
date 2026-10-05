from fastapi import APIRouter, Depends, Query
from app.middleware.auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/api/v1/schemes", tags=["schemes"])

SCHEMES = [
    {
        "id": "disease_subsidy",
        "name": "Rajya Krishi Suraksha Yojana",
        "description": "State pesticide subsidy for crop disease treatment",
        "benefit": "50% subsidy on certified pesticides",
        "link": "https://agricoop.nic.in",
        "category": "Subsidy",
        "crop": "All"
    },
    {
        "id": "soil_health_card",
        "name": "Soil Health Card Scheme",
        "description": "Free soil testing and recommendations",
        "benefit": "Free soil health card + fertilizer subsidy",
        "link": "https://soilhealth.dac.gov.in",
        "category": "Soil",
        "crop": "All"
    },
    {
        "id": "PMFBY_drought",
        "name": "Pradhan Mantri Fasal Bima Yojana",
        "description": "Crop insurance for drought/flood losses",
        "benefit": "Crop loss compensation up to ₹2 lakh",
        "link": "https://pmfby.gov.in",
        "category": "Insurance",
        "crop": "All"
    },
    {
        "id": "KCC",
        "name": "Kisan Credit Card",
        "description": "Low-interest credit for agricultural expenses",
        "benefit": "Credit up to ₹3 lakh at 4% interest",
        "link": "https://www.nabard.org/kcc",
        "category": "Credit",
        "crop": "All"
    },
    {
        "id": "low_yield_support",
        "name": "PM-KISAN + SMAM",
        "description": "Income support + machinery assistance",
        "benefit": "₹6000/year + 50% subsidy on agri machinery",
        "link": "https://pmkisan.gov.in",
        "category": "Income Support",
        "crop": "All"
    },
    {
        "id": "critical_health",
        "name": "National Food Security Mission",
        "description": "Comprehensive support for distressed farms",
        "benefit": "Seeds, fertilizers, training support",
        "link": "https://nfsm.gov.in",
        "category": "General",
        "crop": "Wheat"
    }
]

STATE_RULES = {
    "maharashtra": [
        {
            "id": "mah_solar",
            "name": "Mukhyamantri Saur Krishi Vahini Yojana",
            "description": "Solar pump subsidy for Maharashtra farmers",
            "benefit": "Up to 90% subsidy on solar pump installation",
            "link": "https://www.mahadiscom.in",
            "category": "Infrastructure",
            "crop": "All"
        }
    ],
    "punjab": [
        {
            "id": "pun_crop_residue",
            "name": "In-situ Crop Residue Management Scheme",
            "description": "Subsidy on crop residue machinery to prevent stubble burning",
            "benefit": "50% to 80% subsidy on machinery",
            "link": "https://agripunjab.gov.in",
            "category": "Subsidy",
            "crop": "Rice"
        }
    ]
}

@router.get("")
async def get_schemes(
    state: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    crop: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    results = SCHEMES.copy()
    if state and state.lower() in STATE_RULES:
        results.extend(STATE_RULES[state.lower()])
        
    filtered = []
    for s in results:
        if category and s["category"].lower() != category.lower():
            continue
        if crop and s["crop"].lower() != "all" and crop.lower() not in s["crop"].lower():
            continue
        filtered.append(s)
        
    return filtered

@router.get("/apply/{scheme_id}")
async def apply_scheme(
    scheme_id: str,
    user=Depends(get_current_user)
):
    # Find link in static schemes or state schemes
    all_schemes = SCHEMES.copy()
    for rules in STATE_RULES.values():
        all_schemes.extend(rules)
        
    scheme = next((s for s in all_schemes if s["id"] == scheme_id), None)
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
        
    return {
        "application_link": scheme["link"],
        "documents_needed": ["Aadhaar Card", "Land Ownership Proof (7/12 Extract)", "Bank Passbook", "Soil Health Card (optional)"],
        "deadline": "31-Dec-2026"
    }
