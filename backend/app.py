import base64
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import Groq
import httpx
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError
import uvicorn

def _env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default

ENV_PATH = Path(__file__).resolve().with_name(".env")
load_dotenv(dotenv_path=ENV_PATH)

MONGO_URI = os.getenv("MONGO_URI", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY", "").strip()
    or os.getenv("EXPO_PUBLIC_GEMINI_API_KEY", "").strip()
)
# Defaulting to Flash for maximum speed during your demo
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() 
PORT = int(os.getenv("PORT", "5000"))
DB_CONNECT_TIMEOUT_MS = int(os.getenv("DB_CONNECT_TIMEOUT_MS", "8000"))

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is required in environment variables.")

db_name_from_uri = urlparse(MONGO_URI).path.lstrip("/")
db_name = os.getenv("MONGO_DB_NAME", "").strip() or db_name_from_uri or "mindsync"

_mongo_client: MongoClient | None = None
_gemini_http_client: httpx.AsyncClient | None = None
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
EMOTION_LABELS = {"happy", "sad", "angry", "surprise", "fear", "disgust", "neutral"}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _serialize_doc(doc: dict) -> dict:
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    if isinstance(out.get("date"), datetime):
        out["date"] = out["date"].isoformat()
    return out

def _parse_object_id(raw_id: str) -> ObjectId:
    try:
        return ObjectId(raw_id)
    except InvalidId as exc:
        raise ValueError("Invalid document id format.") from exc

def _parse_filter_datetime(raw_value: str | None, field_name: str, end_of_day: bool = False) -> datetime | None:
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be ISO format") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    if end_of_day and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed.astimezone(timezone.utc)

def _normalize_limit(raw_limit, default: int = 500, max_limit: int = 5000) -> int:
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = default
    return max(1, min(max_limit, limit))

def _build_journal_query(user_id: str, start_date: str | None = None, end_date: str | None = None, text_query: str | None = None) -> dict:
    uid = str(user_id).strip()
    if not uid:
        raise ValueError("userId is required")
    query: dict = {"userId": uid}
    start_dt = _parse_filter_datetime(start_date, "startDate")
    end_dt = _parse_filter_datetime(end_date, "endDate", end_of_day=True)
    if start_dt or end_dt:
        date_filter: dict = {}
        if start_dt: date_filter["$gte"] = start_dt
        if end_dt: date_filter["$lte"] = end_dt
        query["date"] = date_filter
    keyword = str(text_query or "").strip()
    if keyword:
        escaped = re.escape(keyword)
        query["$or"] = [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"content": {"$regex": escaped, "$options": "i"}},
            {"aiAnalysis": {"$regex": escaped, "$options": "i"}},
        ]
    return query

def _get_mongo_client() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=DB_CONNECT_TIMEOUT_MS)
    return _mongo_client

def _get_collections():
    database = _get_mongo_client()[db_name]
    return database["journals"], database["emotionhistories"]

def _get_gemini_http_client() -> httpx.AsyncClient:
    global _gemini_http_client
    if _gemini_http_client is None:
        _gemini_http_client = httpx.AsyncClient(timeout=60.0)
    return _gemini_http_client

def _default_emotion_payload(details: str = "No clear face detected.") -> dict:
    return {"emotion": "neutral", "confidence": 0, "details": details}

async def _analyze_with_gemini(base64_image: str, mime_type: str) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is missing")

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    prompt = (
        "Analyze the face in this image for micro-expressions. Return strictly valid JSON with keys: emotion, confidence, details. "
        "The emotion must be exactly one of: happy, sad, angry, surprise, fear, disgust, neutral. "
        "Confidence is 0-100. Details should be a short 1-sentence analysis of the subtle facial cues. If you detect conflicting micro-expressions (like a fake smile), note it in the details."
    )
    
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mime_type, "data": base64_image}}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }

    client = _get_gemini_http_client()
    response = await client.post(endpoint, json=payload, headers={"Content-Type": "application/json"})
    response.raise_for_status()
    
    decoded = response.json()
    try:
        text = decoded["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        return {
            "emotion": str(parsed.get("emotion", "neutral")).lower(),
            "confidence": int(parsed.get("confidence", 0)),
            "details": str(parsed.get("details", ""))
        }
    except (KeyError, json.JSONDecodeError, IndexError):
        return _default_emotion_payload("Failed to parse Gemini output.")

@app.on_event("shutdown")
async def close_clients():
    global _gemini_http_client
    if _gemini_http_client is not None:
        await _gemini_http_client.aclose()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/journals")
def get_journals(userId: str | None = None):
    if not userId: return []
    journals, _ = _get_collections()
    docs = list(journals.find({"userId": userId}).sort("date", DESCENDING))
    return [_serialize_doc(doc) for doc in docs]

@app.get("/api/journals/search")
def search_journals(
    userId: str,
    startDate: str | None = None,
    endDate: str | None = None,
    q: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
    sort: str = "desc",
):
    try:
        query = _build_journal_query(user_id=userId, start_date=startDate, end_date=endDate, text_query=q)
        journals, _ = _get_collections()
        direction = ASCENDING if sort.lower() == "asc" else DESCENDING
        docs = list(journals.find(query).sort("date", direction).limit(limit))
        return [_serialize_doc(doc) for doc in docs]
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch journals"})

@app.post("/api/journals")
async def create_journal(request: Request):
    journals, _ = _get_collections()
    payload = await request.json()
    doc = {
        "userId": str(payload.get("userId", "")),
        "userEmail": str(payload.get("userEmail", "")),
        "title": str(payload.get("title", "Untitled Entry")),
        "content": str(payload.get("content", "")),
        "date": _utc_now(),
        "sentimentScore": payload.get("sentimentScore", 0),
        "aiAnalysis": payload.get("aiAnalysis", ""),
    }
    inserted = journals.insert_one(doc)
    return JSONResponse(status_code=201, content=_serialize_doc(journals.find_one({"_id": inserted.inserted_id})))

@app.delete("/api/journals/{journal_id}")
def delete_journal(journal_id: str):
    try:
        journals, _ = _get_collections()
        oid = _parse_object_id(journal_id)
        result = journals.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"error": "Journal not found"})
        return {"message": "Journal deleted successfully"}
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to delete journal"})

@app.put("/api/journals/{journal_id}")
async def update_journal(journal_id: str, request: Request):
    try:
        journals, _ = _get_collections()
        oid = _parse_object_id(journal_id)
        payload = await request.json()
        allowed_fields = {"userId", "userEmail", "title", "content", "date", "sentimentScore", "aiAnalysis"}
        updates = {k: v for k, v in payload.items() if k in allowed_fields}
        if not updates:
            return JSONResponse(status_code=400, content={"error": "No valid fields to update"})
        journals.update_one({"_id": oid}, {"$set": updates})
        updated = journals.find_one({"_id": oid})
        return _serialize_doc(updated)
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to update journal"})

@app.post("/api/analyze")
async def analyze_journal(request: Request):
    payload = await request.json()
    chat_completion = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are an empathetic AI journaling assistant. Keep it under 4 sentences."},
            {"role": "user", "content": str(payload.get("content", ""))}
        ],
        model="llama-3.1-8b-instant",
        temperature=0.7,
    )
    return {"analysis": chat_completion.choices[0].message.content if chat_completion.choices else ""}

@app.post("/api/emotion")
async def detect_emotion(
    image: UploadFile = File(...),
    userId: str = Form(default=""),
    userEmail: str = Form(default=""),
):
    try:
        image_bytes = await image.read()
        base64_img = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = image.content_type or "image/jpeg"
        
        emotion_data = await _analyze_with_gemini(base64_img, mime_type)

        emotion_doc = {
            "userId": userId,
            "userEmail": userEmail,
            "emotion": emotion_data["emotion"],
            "confidence": emotion_data["confidence"],
            "details": emotion_data["details"],
            "date": _utc_now(),
        }

        try:
            _, emotion_history = _get_collections()
            emotion_history.insert_one(emotion_doc)
        except PyMongoError:
            pass # Continue even if saving history fails

        return emotion_data
    except Exception as e:
        import traceback
        print("\n=== GEMINI API CRASH ===")
        traceback.print_exc()  # This prints the deep system error
        print("========================\n")
        return JSONResponse(status_code=500, content={"error": "Detection failed"})

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)