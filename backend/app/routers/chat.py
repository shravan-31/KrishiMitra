from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
import os
import json
import httpx
from app.middleware.auth import get_current_user
from app.database import get_db
from app.integration_engine import load_farm_context
from app.config import settings

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

class ChatRequest(BaseModel):
    farm_id: int
    message: str
    language: Optional[str] = "en"

# Simple heuristic language detector
def detect_language(text: str) -> str:
    # Check for Indian script ranges or simple patterns
    # Dev/stub detection
    text_lower = text.lower()
    if any(c in text for c in ["नमस्ते", "कैसे", "किसान"]):
        return "hi"
    elif any(c in text for c in ["नमस्कार", "कसा", "शेतकरी"]):
        return "mr"
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
    return mapping.get(code.lower(), "English")

async def generate_gemini_response(system_prompt: str, user_message: str) -> str:
    if not settings.gemini_api_key:
        return "Gemini API key is not configured."
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_message}
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": system_prompt}
            ]
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=20.0)
            if response.status_code == 200:
                result = response.json()
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                return text
            else:
                return f"Error from Gemini API: {response.text}"
    except Exception as e:
        return f"Failed to connect to AI engine: {e}"

async def generate_groq_response(system_prompt: str, user_message: str) -> str:
    if not settings.groq_api_key:
        return "Namaste! This is KrishiMitra. (Note: Neither GEMINI_API_KEY nor GROQ_API_KEY is set. Please configure them in your .env file.)"
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": settings.groq_temperature,
        "max_tokens": settings.groq_max_tokens
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=20.0)
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                return f"Error from Groq API: {response.text}"
    except Exception as e:
        return f"Failed to connect to Groq AI engine: {e}"

@router.post("/message")
async def chat_message(
    req: ChatRequest,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Step 1: Load Farm Context
    context = await load_farm_context(req.farm_id, db)
    
    # Step 2: Language handling
    lang_code = req.language or detect_language(req.message)
KRISHIMITRA_SAFETY_RULES = """
CRITICAL AGRICULTURAL & PESTICIDE SAFETY GUARDRAILS:
1. NO UNNECESSARY CHEMICAL PESTICIDES: NEVER recommend chemical pesticides when there is no confirmed disease or pest. If a farmer asks for a chemical or 'strong' pesticide dose for healthy crops, you must REFUSE chemical treatment, explain that healthy crops do not require toxic chemicals, and recommend routine crop monitoring and Integrated Pest Management (IPM).
2. UNCERTAIN / LOW CONFIDENCE DIAGNOSES: If model confidence is low (<60%) or the diagnosis is uncertain, clearly state that the identification is not confirmed. Refuse to prescribe chemical treatments for unverified diagnoses, and instruct the farmer to consult a local Krishi Vigyan Kendra (KVK) or agricultural extension officer with a physical leaf sample.
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

@router.post("/message")
async def chat_message(
    req: ChatRequest,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Step 1: Load Farm Context
    context = await load_farm_context(req.farm_id, db)
    
    # Step 2: Language handling
    lang_code = req.language or detect_language(req.message)
    lang_name = get_language_name(lang_code)
    
    # Step 3: Build Prompts with Safety Guardrails (Fix 12)
    system_prompt = build_system_prompt(lang_name)
    user_prompt = f"{req.message}\n\nFarmer's Farm Context Data: {json.dumps(context, default=str)}"
    
    # Step 4: Call Gemini or Groq
    if settings.gemini_api_key:
        reply = await generate_gemini_response(system_prompt, user_prompt)
    else:
        reply = await generate_groq_response(system_prompt, user_prompt)
    
    return {
        "reply": reply,
        "language_detected": lang_code
    }

# Streaming WebSocket route
@router.websocket("/ws/stream/{farm_id}")
async def websocket_chat_stream(websocket: WebSocket, farm_id: int, db=Depends(get_db)):
    await websocket.accept()
    try:
        # Load farm context once
        context = await load_farm_context(farm_id, db)
        while True:
            # Receive client message
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            message = data.get("message", "")
            lang_code = data.get("language", "en")
            lang_name = get_language_name(lang_code)
            
            system_prompt = build_system_prompt(lang_name)
            user_prompt = f"{message}\n\nFarmer's Farm Context Data: {json.dumps(context, default=str)}"
            
            if not settings.gemini_api_key:
                if settings.groq_api_key:
                    # Stream from Groq API (Llama 3.3)
                    url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": settings.groq_model,
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
                                            except Exception:
                                                pass
                                else:
                                    await websocket.send_json({"token": f"Error: {response.status_code}"})
                    except Exception as e:
                        await websocket.send_json({"token": f"Streaming error: {e}"})
                    await websocket.send_json({"done": True})
                    continue
                else:
                    msg = "Namaste! KrishiMitra AI engine requires GROQ_API_KEY to be configured in .env."
                    await websocket.send_json({"token": msg})
                    await websocket.send_json({"done": True})
                    continue

            # Stream from Gemini API
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key={settings.gemini_api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]}
            }
            
            try:
                async with httpx.AsyncClient() as client:
                    async with client.stream("POST", url, headers=headers, json=payload, timeout=20.0) as response:
                        if response.status_code == 200:
                            async for chunk in response.aiter_text():
                                if chunk.strip():
                                    try:
                                        chunk_json = json.loads(chunk.strip())
                                        for cand in chunk_json.get("candidates", []):
                                            for part in cand.get("content", {}).get("parts", []):
                                                token = part.get("text", "")
                                                if token:
                                                    await websocket.send_json({"token": token})
                                    except Exception:
                                        pass
                        else:
                            await websocket.send_json({"token": f"Error: {response.status_code}"})
            except Exception as e:
                await websocket.send_json({"token": f"Streaming error: {e}"})
                
            await websocket.send_json({"done": True})
            
    except WebSocketDisconnect:
        pass
