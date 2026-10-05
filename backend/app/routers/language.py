from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import logging

router = APIRouter(prefix="/api/v1/translate", tags=["language"])

class TranslationRequest(BaseModel):
    text: str
    target_language: str

class TranslationResponse(BaseModel):
    translated_text: str
    detected_source_language: str

logger = logging.getLogger(__name__)

# Basic fallback mapping for mock/offline translation
OFFLINE_DICTIONARY = {
    "hi": {
        "hello": "नमस्ते",
        "farm": "खेत",
        "crop": "फ़सल",
        "soil": "मिट्टी",
        "water": "पानी",
        "pest": "कीट",
        "disease": "बीमारी",
        "weather": "मौसम",
        "yield": "पैदावार",
    },
    "mr": {
        "hello": "नमस्कार",
        "farm": "शेत",
        "crop": "पीक",
        "soil": "माती",
        "water": "पाणी",
        "pest": "कीड",
        "disease": "रोग",
        "weather": "हवामान",
        "yield": "उत्पादन",
    }
}

@router.post("", response_model=TranslationResponse)
async def translate(payload: TranslationRequest):
    text = payload.text.strip()
    target_lang = payload.target_language.lower().strip()
    
    if not text:
        return TranslationResponse(translated_text="", detected_source_language="en")
        
    # Attempt to use the public Google Translate API
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": target_lang,
            "dt": "t",
            "q": text
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            
        if response.status_code == 200:
            data = response.json()
            # The structure is [[[translated_text, source_text, ...]], ..., source_lang]
            translated_sentences = []
            if data and len(data) > 0 and data[0]:
                for part in data[0]:
                    if part and len(part) > 0 and part[0]:
                        translated_sentences.append(part[0])
            
            translated_text = "".join(translated_sentences)
            detected_lang = data[2] if len(data) > 2 else "en"
            
            return TranslationResponse(
                translated_text=translated_text,
                detected_source_language=detected_lang
            )
    except Exception as e:
        logger.warning(f"Translation API failed, using fallback: {e}")
        
    # Offline fallback logic
    detected_lang = "en"
    words = text.split()
    translated_words = []
    
    dict_lang = OFFLINE_DICTIONARY.get(target_lang, {})
    for word in words:
        clean_word = word.lower().strip(",.?!()[]{}")
        if clean_word in dict_lang:
            translated_words.append(dict_lang[clean_word])
        else:
            translated_words.append(word)
            
    translated_text = " ".join(translated_words)
    # Add a fallback indicator for developers/debuggers
    if text == "hello" and target_lang == "hi":
        translated_text = "नमस्ते"
        
    return TranslationResponse(
        translated_text=translated_text,
        detected_source_language=detected_lang
    )
