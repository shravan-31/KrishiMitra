from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from typing import Optional
import os
import json
import logging
import asyncio
import httpx
from app.middleware.auth import get_current_user
from app.database import get_db
from app.integration_engine import load_farm_context
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

class ChatRequest(BaseModel):
    farm_id: Optional[int] = None
    message: str
    language: Optional[str] = "en"

# Simple heuristic language detector
def detect_language(text: str) -> str:
    text_lower = text.lower()
    if any(c in text for c in ["नमस्ते", "कैसे", "किसान", "फसल", "खाद", "दवा"]):
        return "hi"
    elif any(c in text for c in ["नमस्कार", "कसा", "शेतकरी", "पीक", "खत"]):
        return "mr"
    elif any(c in text for c in ["ਕਿਵੇਂ", "ਕਿਸਾਨ", "ਫਸਲ"]):
        return "pa"
    elif any(c in text for c in ["કેમ", "ખેડૂત", "પાક"]):
        return "gu"
    elif any(c in text for c in ["ఎలా", "రైతు", "పంట"]):
        return "te"
    elif any(c in text for c in ["எப்படி", "விவசாயி", "பயிர்"]):
        return "ta"
    elif any(c in text for c in ["ಹೇಗೆ", "ರೈತ", "ಬೆಳೆ"]):
        return "kn"
    elif any(c in text for c in ["কেমন", "কৃষক", "ফসল"]):
        return "bn"
    return "en"

def get_language_name(code: str) -> str:
    mapping = {
        "hi": "Hindi",
        "mr": "Marathi",
        "pa": "Punjabi",
        "gu": "Gujarati",
        "te": "Telugu",
        "ta": "Tamil",
        "kn": "Kannada",
        "bn": "Bengali",
        "or": "Odia",
        "ml": "Malayalam",
        "en": "English"
    }
    return mapping.get((code or "en").lower(), "English")

KRISHIMITRA_SAFETY_RULES = """
CRITICAL AGRICULTURAL & PESTICIDE SAFETY GUARDRAILS:
1. NO UNNECESSARY CHEMICAL PESTICIDES: NEVER recommend chemical pesticides when there is no confirmed disease or pest. If a farmer asks for a chemical or 'strong' pesticide dose for healthy crops, you must REFUSE chemical treatment, explain that healthy crops do not require toxic chemicals, and recommend routine crop monitoring and Integrated Pest Management (IPM).
2. UNCERTAIN / LOW CONFIDENCE DIAGNOSES: If diagnosis is uncertain, clearly state that the identification is not confirmed. Refuse to prescribe chemical treatments for unverified diagnoses, and instruct the farmer to consult a local Krishi Vigyan Kendra (KVK) or agricultural extension officer with a physical leaf sample.
3. PREFER INTEGRATED PEST MANAGEMENT (IPM): Always prioritize organic, biological (e.g., neem oil, Trichoderma viride), cultural, and mechanical remedies before chemical options.
4. ACCURATE DOSAGE & LABEL COMPLIANCE: Do not fabricate chemical products or unverified dosages. Clearly instruct the farmer to always follow the manufacturer's approved package label and dilution instructions approved by the Central Insecticides Board & Registration Committee (CIBRC). Never advise exceeding label rates or mixing incompatible agrochemicals.
5. MANDATORY SAFETY & PPE: Highlight essential personal protective equipment (gloves, mask, eye protection), ideal spraying weather (calm wind, no rain), and pre-harvest intervals (PHI).
"""

def build_system_prompt(lang_name: str) -> str:
    return (
        f"You are KrishiMitra, an expert AI agricultural assistant serving Indian farmers.\n"
        f"Always respond respectfully in {lang_name}. Use local crop names and practical language.\n"
        f"Reference the farmer's actual context data where available.\n\n"
        f"{KRISHIMITRA_SAFETY_RULES}\n"
        f"Keep replies concise, safe, empowering, and actionable."
    )

def get_expert_fallback_response(user_message: str, lang_code: str) -> str:
    """Intelligent offline agricultural knowledge base if external LLM APIs are unreachable."""
    msg = user_message.lower()
    
    # Hindi responses
    if lang_code == "hi":
        if any(w in msg for w in ["खाद", "उर्वरक", "fertilizer", "npk"]):
            return (
                "नमस्ते किसान भाई! फसल के संतुलित पोषण के लिए:\n"
                "1. सबसे पहले मृदा स्वास्थ्य कार्ड (Soil Health Card) के अनुसार ही NPK खाद डालें। सामान्यतः अनाज फसलों के लिए 4:2:1 का अनुपात उपयुक्त रहता है।\n"
                "2. रासायनिक खाद के साथ प्रति एकड़ 2-3 ट्रॉली अच्छी सड़ी गोबर की खाद या वर्मीकम्पोस्ट अवश्य मिलाएं।\n"
                "3. यूरिया को एक साथ न डालकर 2-3 किस्तों में (टॉप ड्रेसिंग) दें।\n"
                "अधिक जानकारी के लिए नजदीकी कृषि विज्ञान केंद्र (KVK) से संपर्क करें।"
            )
        elif any(w in msg for w in ["बीमारी", "रोग", "disease", "फंगस", "पत्ते"]):
            return (
                "नमस्ते! फसल में रोग प्रबंधन के लिए प्राथमिक सुझाव:\n"
                "1. रोगग्रस्त पत्तियों या पौधों को तुरंत खेत से हटाकर नष्ट करें ताकि संक्रमण न फैले।\n"
                "2. शुरुआती रोकथाम के लिए 5 मि.ली. नीम का तेल (Neem Oil 1500 ppm) प्रति लीटर पानी में घोलकर छिड़काव करें।\n"
                "3. फफूंद जनित रोगों के लिए ट्राइकोडर्मा विरिडी (Trichoderma viride) जैविक फफूंदनाशी का उपयोग करें।\n"
                "4. सटीक पहचान के बिना कोई भी तीव्र रासायनिक छिड़काव न करें। पत्ते का नमूना KVK विशेषज्ञ को दिखाएं।"
            )
        elif any(w in msg for w in ["कीट", "कीड़ा", "pest", "इल्ली", "माहू"]):
            return (
                "नमस्ते! एकीकृत कीट प्रबंधन (IPM) के तहत सुझाव:\n"
                "1. रसचूसक कीटों (माहू, सफेद मक्खी) के लिए खेत में पीले चिपचिपे कार्ड (Yellow Sticky Traps - 10-15 प्रति एकड़) लगाएं।\n"
                "2. जैविक नियंत्रण के लिए नीम अर्क (5%) या नीम तेल 5 मि.ली./लीटर का छिड़काव करें।\n"
                "3. कीटनाशक का छिड़काव हमेशा शांत हवा और बिना बारिश के समय दस्ताने व मास्क पहनकर ही करें।"
            )
        elif any(w in msg for w in ["योजना", "scheme", "सब्सिडी", "पैसा"]):
            return (
                "नमस्ते किसान भाई! प्रमुख सरकारी कृषि योजनाएं:\n"
                "1. PM-KISAN: पात्र किसानों को प्रति वर्ष ₹6,000 (तीन किस्तों में)।\n"
                "2. PMFBY (फसल बीमा योजना): प्राकृतिक आपदाओं से फसल नुकसान पर न्यूनतम प्रीमियम में सुरक्षा।\n"
                "3. किसान क्रेडिट कार्ड (KCC): कम ब्याज दर (4%) पर कृषि ऋण।\n"
                "4. मृदा स्वास्थ्य कार्ड योजना: खेत की मिट्टी की मुफ्त जांच।\n"
                "आवेदन के लिए pmkisan.gov.in या नजदीकी CSC केंद्र पर जाएं।"
            )
        else:
            return (
                "नमस्ते किसान भाई! मैं कृषि मित्र (KrishiMitra) हूँ।\n"
                "मैं आपकी फसल सुरक्षा, खाद प्रबंधन, मौसम सलाह, कीट-रोग निदान और सरकारी योजनाओं में सहायता कर सकता हूँ।\n"
                "कृपया अपनी फसल का नाम और समस्या विस्तार से बताएं (जैसे: 'गेहूं में पीलापन' या 'टमाटर में कीट')।"
            )
    
    # Marathi responses
    elif lang_code == "mr":
        if any(w in msg for w in ["खत", "fertilizer", "npk"]):
            return (
                "नमस्कार शेतकरी बंधू! पिकाच्या संतुलित पोषणासाठी सल्ला:\n"
                "1. माती परीक्षण अहवालानुसारच खतांचा वापर करा. नत्र, स्फुरद व पालाश योग्य प्रमाणात द्या.\n"
                "2. सेंद्रिय कर्ब वाढवण्यासाठी शेणखत किंवा गांडूळ खताचा (Vermicompost) वापर वाढवा.\n"
                "3. सूक्ष्म अन्नद्रव्यांची कमतरता असल्यास फवारणीद्वारे पूर्तता करा."
            )
        elif any(w in msg for w in ["रोग", "disease", "बुरशी", "पाने"]):
            return (
                "नमस्कार! पिकांवरील रोग नियंत्रणासाठी महत्त्वाचे उपाय:\n"
                "1. रोगट पाने गोळा करून शेताबाहेर नष्ट करा.\n"
                "2. प्राथमिक नियंत्रणासाठी निंबोळी अर्क (५%) किंवा ट्रायकोडर्मा (Trichoderma) वापरा.\n"
                "3. कोणत्याही रासायनिक बुरशीनाशकाची फवारणी करण्यापूर्वी कृषी तज्ज्ञांचा सल्ला घ्या."
            )
        else:
            return (
                "नमस्कार शेतकरी मित्र! मी कृषीमित्र (KrishiMitra) आहे.\n"
                "मी तुम्हाला पिके, खते, रोग-कीड नियंत्रण, हवामान व शासकीय योजनांविषयी अचूक माहिती देऊ शकतो.\n"
                "आपल्या पिकाचे नाव आणि नेमकी समस्या विचारू शकता."
            )

    # English responses (Default)
    if any(w in msg for w in ["fertilizer", "nutrient", "npk", "urea", "dosage"]):
        return (
            "Namaste! For optimal crop nutrition and fertilizer management:\n"
            "1. Base your fertilizer doses strictly on a Soil Health Card report. General cereal crops require an NPK ratio of around 4:2:1.\n"
            "2. Integrate 2-3 tonnes of farmyard manure or vermicompost per acre to improve soil organic carbon.\n"
            "3. Split Nitrogen (Urea) applications into 2-3 split doses rather than applying all at once.\n"
            "4. Avoid excessive nitrogen which promotes pest infestations and fungal lodging."
        )
    elif any(w in msg for w in ["disease", "fungus", "blight", "yellow", "rot", "wilt"]):
        return (
            "Namaste! For effective and safe crop disease management:\n"
            "1. Practice crop sanitation: prune and destroy heavily infected leaves immediately.\n"
            "2. Use biological controls: Neem oil (1500 ppm at 5ml/L water) or Trichoderma viride as prophylactic sprays.\n"
            "3. Ensure proper drainage to prevent waterlogging and fungal root rot.\n"
            "4. Do not apply synthetic fungicides without confirmed identification. Please share a leaf sample with your local Krishi Vigyan Kendra (KVK)."
        )
    elif any(w in msg for w in ["pest", "insect", "worm", "caterpillar", "aphid", "borer"]):
        return (
            "Namaste! For Integrated Pest Management (IPM):\n"
            "1. Install Yellow/Blue Sticky Traps (10-15 traps/acre) and Pheromone traps to monitor and catch early adult populations.\n"
            "2. Spray 5% Neem Seed Kernel Extract (NSKE) or Neem Oil 5ml/L as a safe, broad-spectrum repellent.\n"
            "3. If synthetic insecticides are strictly necessary, always wear personal protective gear (PPE) and spray during calm, clear weather."
        )
    elif any(w in msg for w in ["scheme", "government", "subsidy", "pmkisan", "pm-kisan", "insurance"]):
        return (
            "Namaste! Key Government Agricultural Welfare Schemes for Indian Farmers:\n"
            "1. PM-KISAN: Direct income support of ₹6,000/year to eligible farmer families in 3 equal installments.\n"
            "2. PMFBY (Pradhan Mantri Fasal Bima Yojana): Low-cost comprehensive crop insurance against non-preventable natural risks.\n"
            "3. Kisan Credit Card (KCC): Concessional crop loans up to ₹3 lakh at 4% effective interest upon timely repayment.\n"
            "4. Soil Health Card Scheme: Free 12-parameter soil testing every 2 years."
        )
    elif any(w in msg for w in ["harvest", "reap", "cutting", "storage"]):
        return (
            "Namaste! Harvesting and Post-Harvest Best Practices:\n"
            "1. Harvest during dry, sunny weather when grain moisture is ideally around 14-16%.\n"
            "2. Dry the produce thoroughly in shade/sun down to 10-12% moisture before hermetic storage.\n"
            "3. Clean and disinfest granaries to prevent storage pests like weevils and flour beetles."
        )
    else:
        return (
            "Namaste! I am KrishiMitra, your intelligent agricultural assistant.\n"
            "I can assist you with:\n"
            "• Crop disease diagnosis & biological remedies\n"
            "• Pest monitoring & Integrated Pest Management (IPM)\n"
            "• Soil health, fertilizer & NPK balancing\n"
            "• Government schemes (PM-KISAN, PMFBY, KCC)\n"
            "• Weather-based irrigation and spraying schedules\n\n"
            "Please tell me what crop you are growing and what question you have!"
        )

def get_groq_keys() -> list[str]:
    keys = []
    if settings.groq_api_key:
        keys.append(settings.groq_api_key)
    env_key = os.getenv("GROQ_API_KEY")
    if env_key and env_key not in keys:
        keys.append(env_key)
    return keys

async def generate_groq_response(system_prompt: str, user_message: str) -> Optional[str]:
    """Call Groq API with automatic fallback across reliable models and keys."""
    keys = get_groq_keys()
    if not keys:
        return None
    
    models_to_try = [
        settings.groq_model,
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768"
    ]
    seen = set()
    models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    for api_key in keys:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        for model_name in models:
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": settings.groq_temperature,
                "max_tokens": settings.groq_max_tokens
            }
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, headers=headers, json=payload, timeout=18.0)
                    if response.status_code == 200:
                        result = response.json()
                        content = result["choices"][0]["message"]["content"]
                        if content and content.strip():
                            return content.strip()
                    else:
                        logger.warning(f"Groq {model_name} with key {api_key[:8]}... returned status {response.status_code}")
            except Exception as e:
                logger.warning(f"Groq {model_name} request failed: {e}")
                continue
                
    return None

async def generate_gemini_response(system_prompt: str, user_message: str) -> Optional[str]:
    """Call Gemini REST API."""
    if not settings.gemini_api_key:
        return None
    
    models = ["gemini-1.5-flash", "gemini-1.5-pro"]
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": user_message}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]}
    }
    
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=18.0)
                if response.status_code == 200:
                    result = response.json()
                    candidates = result.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"].strip()
                else:
                    logger.warning(f"Gemini {model} returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"Gemini {model} call failed: {e}")
            continue
            
    return None

async def get_optional_db():
    """Optional database connection dependency — yields None if DB pool is unavailable."""
    import app.database as db_module
    if getattr(db_module, "pool", None) is None:
        yield None
        return
    try:
        async with db_module.pool.acquire() as conn:
            yield conn
    except Exception as e:
        logger.warning(f"Database connection error in chat: {e}")
        yield None

async def get_optional_user(request: Request, db=Depends(get_optional_db)):
    """Optional user dependency — does not reject anonymous or unauthenticated chat sessions."""
    if not db:
        return None
    try:
        return await get_current_user(request, db)
    except Exception:
        return None

async def safe_load_farm_context(farm_id: Optional[int], db) -> dict:
    if not farm_id or farm_id <= 0 or not db:
        return {}
    try:
        ctx = await load_farm_context(farm_id, db)
        return ctx if isinstance(ctx, dict) else {}
    except Exception as e:
        logger.warning(f"Error loading farm context for id {farm_id}: {e}")
        return {}

async def process_chat_message(
    req: ChatRequest,
    user=None,
    db=None
) -> dict:
    # Step 1: Safely load Farm Context
    context = await safe_load_farm_context(req.farm_id, db)
    
    # Step 2: Language handling
    lang_code = req.language or detect_language(req.message)
    lang_name = get_language_name(lang_code)
    
    # Step 3: Build System & User Prompts
    system_prompt = build_system_prompt(lang_name)
    user_prompt = f"{req.message}"
    if context:
        user_prompt += f"\n\nFarmer's Farm Context Data: {json.dumps(context, default=str)}"
    
    # Step 4: Primary AI (Groq or Gemini) with fallback to intelligent offline agricultural expert
    reply = None
    if settings.groq_api_key:
        reply = await generate_groq_response(system_prompt, user_prompt)
    if not reply and settings.gemini_api_key:
        reply = await generate_gemini_response(system_prompt, user_prompt)
    if not reply:
        reply = get_expert_fallback_response(req.message, lang_code)
    
    return {
        "status": "success",
        "reply": reply,
        "language_detected": lang_code
    }

from fastapi.responses import HTMLResponse, JSONResponse

CHATBOT_HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KrishiMitra AI Agricultural Chatbot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070d07;
      --card-bg: rgba(20, 35, 20, 0.7);
      --card-border: rgba(74, 222, 128, 0.15);
      --primary: #22c55e;
      --primary-hover: #16a34a;
      --accent: #4ade80;
      --text: #f0fdf4;
      --text-muted: #86efac;
      --bubble-ai: rgba(22, 101, 52, 0.25);
      --bubble-user: #15803d;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: radial-gradient(circle at 50% 10%, #0d2812 0%, var(--bg) 70%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(10, 25, 12, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo {
      font-size: 1.75rem;
      background: rgba(34, 197, 94, 0.15);
      padding: 0.4rem;
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }
    .title h1 {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .title p {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 8px #22c55e;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    main {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 75px);
    }
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .message {
      display: flex;
      gap: 0.75rem;
      max-width: 82%;
      animation: fadeIn 0.25s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .message.user { align-self: flex-end; flex-direction: row-reverse; }
    .message.ai { align-self: flex-start; }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid var(--card-border);
    }
    .message.user .avatar { background: #166534; }
    .bubble {
      padding: 0.85rem 1.15rem;
      border-radius: 16px;
      line-height: 1.6;
      font-size: 0.95rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .message.ai .bubble {
      background: var(--bubble-ai);
      border: 1px solid var(--card-border);
      border-top-left-radius: 4px;
      color: #e2e8f0;
    }
    .message.user .bubble {
      background: var(--bubble-user);
      color: #fff;
      border-top-right-radius: 4px;
    }
    .quick-chips {
      padding: 0.75rem 1.25rem;
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      border-top: 1px solid rgba(74, 222, 128, 0.08);
      background: rgba(10, 25, 12, 0.4);
    }
    .chip {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: #86efac;
      padding: 0.4rem 0.9rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .chip:hover {
      background: rgba(34, 197, 94, 0.2);
      color: #fff;
      border-color: #22c55e;
    }
    .input-bar {
      padding: 1rem 1.25rem;
      background: rgba(10, 25, 12, 0.7);
      border-top: 1px solid var(--card-border);
      display: flex;
      gap: 0.75rem;
    }
    .input-bar input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(74, 222, 128, 0.2);
      color: #fff;
      padding: 0.85rem 1.25rem;
      border-radius: 12px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-bar input:focus { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
    .send-btn {
      background: #22c55e;
      color: #052e16;
      border: none;
      border-radius: 12px;
      padding: 0 1.5rem;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .send-btn:hover { background: #4ade80; }
    .send-btn:active { transform: scale(0.98); }
    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      padding: 6px 12px;
    }
    .typing-indicator span {
      width: 6px;
      height: 6px;
      background: #4ade80;
      border-radius: 50%;
      animation: bounce 1.2s infinite ease-in-out;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo">🌾</div>
      <div class="title">
        <h1>KrishiMitra AI Copilot</h1>
        <p>Smart Agriculture & Farm Advisory</p>
      </div>
    </div>
    <div class="status-badge">
      <div class="status-dot"></div>
      <span>AI Online</span>
    </div>
  </header>

  <main>
    <div class="chat-container">
      <div class="messages-area" id="messagesArea">
        <div class="message ai">
          <div class="avatar">🤖</div>
          <div class="bubble">Namaste! I am KrishiMitra, your AI agricultural assistant. 

How can I help you today? Ask me about:
• Crop disease detection & biological remedies
• Pest management & safe organic controls
• Soil NPK fertilizer dosage & balancing
• PM-KISAN, PMFBY & government schemes
• Weather-aligned irrigation & harvesting tips</div>
        </div>
      </div>

      <div class="quick-chips">
        <button class="chip" onclick="askQuestion('What fertilizer ratio should I use for wheat?')">🌱 Fertilizer for Wheat</button>
        <button class="chip" onclick="askQuestion('How to treat yellow leaves organically?')">🍂 Yellow Leaf Treatment</button>
        <button class="chip" onclick="askQuestion('How to control aphids without harmful chemicals?')">🐛 Organic Pest Control</button>
        <button class="chip" onclick="askQuestion('What are the benefits of PM-KISAN and PMFBY?')">🏛️ Government Schemes</button>
      </div>

      <div class="input-bar">
        <input type="text" id="userInput" placeholder="Ask any farming question..." onkeypress="if(event.key==='Enter') sendMessage()" />
        <button class="send-btn" id="sendBtn" onclick="sendMessage()">Send ➔</button>
      </div>
    </div>
  </main>

  <script>
    const messagesArea = document.getElementById('messagesArea');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');

    function scrollToBottom() {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    function appendMessage(sender, text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${sender}`;
      
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.innerText = sender === 'user' ? '👨‍🌾' : '🤖';

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerText = text;

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(bubble);
      messagesArea.appendChild(msgDiv);
      scrollToBottom();
      return bubble;
    }

    function showTyping() {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message ai';
      msgDiv.id = 'typingBubble';
      
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.innerText = '🤖';

      const bubble = document.createElement('div');
      bubble.className = 'bubble typing-indicator';
      bubble.innerHTML = '<span></span><span></span><span></span>';

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(bubble);
      messagesArea.appendChild(msgDiv);
      scrollToBottom();
    }

    function removeTyping() {
      const typing = document.getElementById('typingBubble');
      if (typing) typing.remove();
    }

    async function sendMessage() {
      const text = userInput.value.trim();
      if (!text) return;

      appendMessage('user', text);
      userInput.value = '';
      userInput.disabled = true;
      sendBtn.disabled = true;
      showTyping();

      try {
        const endpoints = [
          '/api/v1/chat/message',
          '/api/chat/message',
          '/api/v1/chat',
          '/api/chat'
        ];

        let result = null;
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text, language: 'en' })
            });
            if (res.ok) {
              result = await res.json();
              break;
            }
          } catch (e) {}
        }

        removeTyping();
        if (result && result.reply) {
          appendMessage('ai', result.reply);
        } else {
          appendMessage('ai', 'Namaste! KrishiMitra is ready. Your question has been noted. Please ensure backend services are connected.');
        }
      } catch (err) {
        removeTyping();
        appendMessage('ai', 'Namaste! I am currently operating in resilient offline mode. Ask about crop diseases, fertilizers, or government schemes!');
      } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
        scrollToBottom();
      }
    }

    function askQuestion(q) {
      userInput.value = q;
      sendMessage();
    }
  </script>
</body>
</html>
"""

# Common chat endpoint handler
async def chat_message_endpoint(
    req: ChatRequest,
    user=Depends(get_optional_user),
    db=Depends(get_optional_db)
):
    return await process_chat_message(req, user, db)

# Common GET status handler
async def chat_status_endpoint(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return HTMLResponse(content=CHATBOT_HTML_PAGE, status_code=200)
    return JSONResponse(
        status_code=200,
        content={
            "status": "online",
            "service": "KrishiMitra Agricultural AI Chatbot",
            "version": "1.0.0",
            "endpoints": [
                "/api/v1/chat/message",
                "/api/chat/message",
                "/api/v1/chat",
                "/api/chat"
            ],
            "websocket_stream": "/api/v1/chat/ws/stream/{farm_id}"
        }
    )

# Common WebSocket stream logic
async def handle_chat_websocket(websocket: WebSocket, farm_id: int):
    await websocket.accept()
    context = {}
    if farm_id > 0:
        import app.database as db_module
        if getattr(db_module, "pool", None) is not None:
            try:
                async with db_module.pool.acquire() as conn:
                    context = await safe_load_farm_context(farm_id, conn)
            except Exception as e:
                logger.warning(f"Failed to acquire db for ws context: {e}")

    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
            except Exception:
                data = {"message": data_str}
                
            message = data.get("message", "").strip()
            if not message:
                continue
                
            lang_code = data.get("language") or detect_language(message)
            lang_name = get_language_name(lang_code)
            
            system_prompt = build_system_prompt(lang_name)
            user_prompt = f"{message}"
            if context:
                user_prompt += f"\n\nFarmer's Farm Context Data: {json.dumps(context, default=str)}"
            
            stream_succeeded = False
            
            # 1. Try Groq Streaming if configured
            groq_keys = get_groq_keys()
            if groq_keys:
                url = "https://api.groq.com/openai/v1/chat/completions"
                for gkey in groq_keys:
                    if stream_succeeded:
                        break
                    headers = {
                        "Authorization": f"Bearer {gkey}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": settings.groq_model or "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": settings.groq_temperature,
                        "max_tokens": settings.groq_max_tokens,
                        "stream": True
                    }
                    try:
                        async with httpx.AsyncClient() as client:
                            async with client.stream("POST", url, headers=headers, json=payload, timeout=20.0) as response:
                                if response.status_code == 200:
                                    async for line in response.aiter_lines():
                                        line = line.strip()
                                        if line.startswith("data:"):
                                            data_content = line[5:].strip()
                                            if data_content == "[DONE]":
                                                break
                                            try:
                                                chunk_json = json.loads(data_content)
                                                token = chunk_json["choices"][0]["delta"].get("content", "")
                                                if token:
                                                    await websocket.send_json({"token": token})
                                                    stream_succeeded = True
                                            except Exception:
                                                pass
                    except Exception as e:
                        logger.warning(f"Groq websocket streaming failed with key {gkey[:8]}...: {e}")
            
            # 2. Try Gemini Streaming if Groq didn't succeed and Gemini key is set
            if not stream_succeeded and settings.gemini_api_key:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key={settings.gemini_api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "systemInstruction": {"parts": [{"text": system_prompt}]}
                }
                try:
                    async with httpx.AsyncClient() as client:
                        async with client.stream("POST", url, headers=headers, json=payload, timeout=20.0) as response:
                            if response.status_code == 200:
                                async for line in response.aiter_lines():
                                    line = line.strip()
                                    if line.startswith("data:"):
                                        data_content = line[5:].strip()
                                        try:
                                            chunk_json = json.loads(data_content)
                                            for cand in chunk_json.get("candidates", []):
                                                for part in cand.get("content", {}).get("parts", []):
                                                    token = part.get("text", "")
                                                    if token:
                                                        await websocket.send_json({"token": token})
                                                        stream_succeeded = True
                                        except Exception:
                                            pass
                except Exception as e:
                    logger.warning(f"Gemini websocket streaming failed: {e}")

            # 3. Fallback to expert offline response streamed smoothly
            if not stream_succeeded:
                fallback_reply = get_expert_fallback_response(message, lang_code)
                words = fallback_reply.split(" ")
                for i, word in enumerate(words):
                    token = word + (" " if i < len(words) - 1 else "")
                    await websocket.send_json({"token": token})
                    await asyncio.sleep(0.015)
                
            await websocket.send_json({"done": True})
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket session terminated: {e}")

# Register routes on primary router: /api/v1/chat
@router.post("/message")
@router.post("")
@router.post("/")
async def chat_message_v1(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@router.get("")
@router.get("/")
@router.get("/message")
@router.get("/health")
async def chat_get_v1(request: Request):
    return await chat_status_endpoint(request)

@router.websocket("/ws/stream/{farm_id}")
async def ws_v1(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

# Alias router 1: /api/chat
legacy_router = APIRouter(prefix="/api/chat", tags=["chat"])

@legacy_router.post("/message")
@legacy_router.post("")
@legacy_router.post("/")
async def chat_message_legacy(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@legacy_router.get("")
@legacy_router.get("/")
@legacy_router.get("/message")
@legacy_router.get("/health")
async def chat_get_legacy(request: Request):
    return await chat_status_endpoint(request)

@legacy_router.websocket("/ws/stream/{farm_id}")
async def ws_legacy(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

# Alias router 2: /api/chatbot & /api/v1/chatbot
chatbot_router = APIRouter(prefix="/api/chatbot", tags=["chat"])

@chatbot_router.post("/message")
@chatbot_router.post("")
@chatbot_router.post("/")
async def chat_message_chatbot(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@chatbot_router.get("")
@chatbot_router.get("/")
@chatbot_router.get("/message")
@chatbot_router.get("/health")
async def chat_get_chatbot(request: Request):
    return await chat_status_endpoint(request)

@chatbot_router.websocket("/ws/stream/{farm_id}")
async def ws_chatbot(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

v1_chatbot_router = APIRouter(prefix="/api/v1/chatbot", tags=["chat"])

@v1_chatbot_router.post("/message")
@v1_chatbot_router.post("")
@v1_chatbot_router.post("/")
async def chat_message_v1_chatbot(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@v1_chatbot_router.get("")
@v1_chatbot_router.get("/")
@v1_chatbot_router.get("/message")
@v1_chatbot_router.get("/health")
async def chat_get_v1_chatbot(request: Request):
    return await chat_status_endpoint(request)

@v1_chatbot_router.websocket("/ws/stream/{farm_id}")
async def ws_v1_chatbot(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

# Direct page routers: /chat and /chatbot
chat_page_router = APIRouter(prefix="/chat", tags=["chat"])

@chat_page_router.post("/message")
@chat_page_router.post("")
@chat_page_router.post("/")
async def chat_message_page(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@chat_page_router.get("")
@chat_page_router.get("/")
@chat_page_router.get("/message")
async def chat_get_page(request: Request):
    return await chat_status_endpoint(request)

@chat_page_router.websocket("/ws/stream/{farm_id}")
async def ws_chat_page(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

chatbot_page_router = APIRouter(prefix="/chatbot", tags=["chat"])

@chatbot_page_router.post("/message")
@chatbot_page_router.post("")
@chatbot_page_router.post("/")
async def chatbot_message_page(req: ChatRequest, user=Depends(get_optional_user), db=Depends(get_optional_db)):
    return await chat_message_endpoint(req, user, db)

@chatbot_page_router.get("")
@chatbot_page_router.get("/")
@chatbot_page_router.get("/message")
async def chatbot_get_page(request: Request):
    return await chat_status_endpoint(request)

@chatbot_page_router.websocket("/ws/stream/{farm_id}")
async def ws_chatbot_page(websocket: WebSocket, farm_id: int):
    await handle_chat_websocket(websocket, farm_id)

