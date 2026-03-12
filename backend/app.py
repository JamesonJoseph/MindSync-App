import base64
import json
import os
import re
import aiohttp
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
    if not doc: return doc
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    if isinstance(out.get("date"), datetime):
        out["date"] = out["date"].isoformat()
    if isinstance(out.get("dueDate"), datetime):
        out["dueDate"] = out["dueDate"].isoformat()
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
    return database["journals"], database["emotionhistories"], database["tasks"]

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

# ==================== JOURNALS ====================

@app.get("/api/journals")
def get_journals(userId: str | None = None):
    if not userId: return []
    journals, _, _ = _get_collections()
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
        journals, _, _ = _get_collections()
        direction = ASCENDING if sort.lower() == "asc" else DESCENDING
        docs = list(journals.find(query).sort("date", direction).limit(limit))
        return [_serialize_doc(doc) for doc in docs]
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to fetch journals"})

@app.post("/api/journals")
async def create_journal(request: Request):
    journals, _, _ = _get_collections()
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
        journals, _, _ = _get_collections()
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
        journals, _, _ = _get_collections()
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

# ==================== TASKS ====================

@app.get("/api/tasks")
def get_tasks(userId: str | None = None):
    if not userId: return []
    _, _, tasks = _get_collections()
    docs = list(tasks.find({"userId": userId}).sort("date", DESCENDING))
    return [_serialize_doc(doc) for doc in docs]

@app.post("/api/tasks")
async def create_task(request: Request):
    _, _, tasks = _get_collections()
    payload = await request.json()
    doc = {
        "userId": str(payload.get("userId", "")),
        "title": str(payload.get("title", "Untitled Task")),
        "description": str(payload.get("description", "")),
        "status": str(payload.get("status", "pending")),
        "date": _utc_now(),
    }
    inserted = tasks.insert_one(doc)
    return JSONResponse(status_code=201, content=_serialize_doc(tasks.find_one({"_id": inserted.inserted_id})))

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    try:
        _, _, tasks = _get_collections()
        oid = _parse_object_id(task_id)
        payload = await request.json()
        allowed_fields = {"title", "description", "status"}
        updates = {k: v for k, v in payload.items() if k in allowed_fields}
        if not updates:
            return JSONResponse(status_code=400, content={"error": "No valid fields to update"})
        tasks.update_one({"_id": oid}, {"$set": updates})
        updated = tasks.find_one({"_id": oid})
        return _serialize_doc(updated)
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to update task"})

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    try:
        _, _, tasks = _get_collections()
        oid = _parse_object_id(task_id)
        result = tasks.delete_one({"_id": oid})
        if result.deleted_count == 0:
            return JSONResponse(status_code=404, content={"error": "Task not found"})
        return {"message": "Task deleted successfully"}
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to delete task"})


# ==================== AI CAPABILITIES ====================

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
            _, emotion_history, _ = _get_collections()
            emotion_history.insert_one(emotion_doc)
        except PyMongoError:
            pass 

        return emotion_data
    except Exception as e:
        import traceback
        print("\n=== GEMINI API CRASH ===")
        traceback.print_exc()
        print("========================\n")
        return JSONResponse(status_code=500, content={"error": "Detection failed"})

# ==================== CHAT AGENT ====================

@app.post("/api/chat")
async def chat_agent(request: Request):
    """
    AI Chat Agent using Groq and Function Calling.
    Provides tools for the AI to manage Tasks and read Journals.
    """
    if not groq_client:
        return JSONResponse(status_code=500, content={"error": "Groq client not configured"})

    payload = await request.json()
    user_id = payload.get("userId")
    messages = payload.get("messages", [])

    if not user_id:
        return JSONResponse(status_code=400, content={"error": "userId is required"})

    # Define tools
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_tasks",
                "description": "Get all tasks for the user.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Create a new task.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Title of the task"},
                        "description": {"type": "string", "description": "Description of the task"},
                        "status": {"type": "string", "description": "Status (e.g., pending, completed)"}
                    },
                    "required": ["title"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_task",
                "description": "Update an existing task status.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string", "description": "ID of the task to update"},
                        "status": {"type": "string", "description": "New status (e.g., completed, pending)"}
                    },
                    "required": ["task_id", "status"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_journals",
                "description": "Get recent journal entries for the user to understand their mood or history.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }
    ]

    try:
        # System message setup
        system_msg = {
            "role": "system", 
            "content": "You are MindSync AI, an empathetic and helpful personal assistant. You can manage tasks and review the user's journal entries to better understand their context and feelings. You may use tools to achieve this."
        }
        
        call_messages = [system_msg] + messages

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=call_messages,
            tools=tools,
            tool_choice="auto",
            max_tokens=4096
        )

        response_message = response.choices[0].message

        # Check if the model wants to call a function
        tool_calls = response_message.tool_calls
        if tool_calls:
            call_messages.append({
                "role": "assistant",
                "content": response_message.content,
                "tool_calls": [t.model_dump() for t in tool_calls]
            })

            journals, _, tasks = _get_collections()

            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                tool_response = ""

                if function_name == "get_tasks":
                    docs = list(tasks.find({"userId": user_id}).sort("date", DESCENDING).limit(10))
                    tool_response = json.dumps([_serialize_doc(d) for d in docs])
                elif function_name == "create_task":
                    doc = {
                        "userId": user_id,
                        "title": function_args.get("title", "Untitled Task"),
                        "description": function_args.get("description", ""),
                        "status": function_args.get("status", "pending"),
                        "date": _utc_now()
                    }
                    inserted = tasks.insert_one(doc)
                    tool_response = json.dumps({"status": "success", "taskId": str(inserted.inserted_id)})
                elif function_name == "update_task":
                    try:
                        oid = _parse_object_id(function_args.get("task_id"))
                        tasks.update_one({"_id": oid}, {"$set": {"status": function_args.get("status")}})
                        tool_response = json.dumps({"status": "success"})
                    except:
                        tool_response = json.dumps({"status": "error", "message": "Invalid task ID"})
                elif function_name == "get_journals":
                    docs = list(journals.find({"userId": user_id}).sort("date", DESCENDING).limit(5))
                    tool_response = json.dumps([_serialize_doc(d) for d in docs])
                else:
                    tool_response = json.dumps({"error": "Unknown function"})

                call_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_response
                })

            # Call the model again with the function response
            second_response = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=call_messages,
                max_tokens=4096
            )
            return {"role": "assistant", "content": second_response.choices[0].message.content}

        return {"role": "assistant", "content": response_message.content}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Chat completion failed"})


# ==================== AVATAR VOICE ANALYSIS ====================

ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "").strip()
CAMB_API_KEY = os.getenv("CAMB_API_KEY", "").strip()
DEFAULT_VOICE_ID = 147320


@app.post("/api/avatar/analyze-voice")
async def analyze_voice(
    audio: UploadFile = File(...),
    userId: str = Form(default=""),
    userEmail: str = Form(default=""),
):
    """Analyze voice audio for tone, emotion, and provide suggestions."""
    try:
        audio_bytes = await audio.read()
        
        # Transcribe using AssemblyAI
        import assemblyai as aai
        
        aai.settings.api_key = ASSEMBLYAI_API_KEY
        transcriber = aai.Transcriber()
        
        # Save audio to temp file for transcription
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.m4a') as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        try:
            transcript = transcriber.transcribe(tmp_path)
            transcript_text = transcript.text if transcript.text else ""
        finally:
            os.unlink(tmp_path)
        
        if not transcript_text:
            return {
                "transcript": "",
                "emotion": "neutral",
                "confidence": 0,
                "suggestions": "I couldn't hear what you said. Could you try again?",
                "earlyWarning": ""
            }
        
        # Get user context for analysis
        user_context = await _get_user_context(userId)
        
        # Analyze tone and emotion using Groq
        system_prompt = f"""You are MindSync AI, an empathetic voice assistant. Analyze the user's speech for:
1. Emotional tone: happy, sad, angry, anxious, frustrated, excited, tired, neutral
2. Confidence level (0-100)
3. Suggestions to improve thought patterns (2-3 sentences, compassionate)
4. Early warning flags if patterns suggest professional support may help

IMPORTANT: Do NOT diagnose mental health conditions. Instead, suggest that "speaking with a professional might help" if concerning patterns are detected.

User Context:
- Name: {user_context.get('name', 'User')}
- Occupation: {user_context.get('occupation', 'Not specified')}
- Recent journal entries: {user_context.get('recent_journals', 'No recent entries')}

Provide your response as JSON with keys: emotion, confidence, suggestions, earlyWarning.
earlyWarning should be empty string if no concerns, otherwise a gentle suggestion to consider professional support."""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcribed speech: {transcript_text}"}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        
        result_text = chat_completion.choices[0].message.content if chat_completion.choices else ""
        
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError:
            result = {
                "emotion": "neutral",
                "confidence": 50,
                "suggestions": result_text or "Thank you for sharing. I'm here to help.",
                "earlyWarning": ""
            }
        
        return {
            "transcript": transcript_text,
            "emotion": result.get("emotion", "neutral"),
            "confidence": result.get("confidence", 0),
            "suggestions": result.get("suggestions", ""),
            "earlyWarning": result.get("earlyWarning", "")
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Voice analysis failed: {str(e)}"})


@app.post("/api/avatar/tts")
async def text_to_speech(request: Request):
    """Convert text to speech using Camb.ai API."""
    try:
        payload = await request.json()
        text = payload.get("text", "")
        voice_id = payload.get("voice_id", DEFAULT_VOICE_ID)
        
        if not text:
            return JSONResponse(status_code=400, content={"error": "Text is required"})
        
        url = "https://client.camb.ai/apis/tts-stream"
        
        headers = {
            "x-api-key": CAMB_API_KEY,
            "Content-Type": "application/json",
        }
        
        payload_tts = {
            "text": text,
            "voice_id": voice_id,
            "language": "en-us",
            "speech_model": "mars-flash",
            "output_configuration": {"format": "wav"},
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload_tts) as resp:
                if resp.status != 200:
                    return JSONResponse(status_code=resp.status, content={"error": "TTS generation failed"})
                
                audio_data = b""
                async for chunk in resp.content.iter_chunked(4096):
                    audio_data += chunk
                
                import base64
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                
                return {
                    "audio": audio_base64,
                    "format": "wav"
                }
                
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"TTS failed: {str(e)}"})


@app.post("/api/avatar/early-warning")
async def early_warning_analysis(request: Request):
    """Analyze user patterns for early warning signs."""
    try:
        payload = await request.json()
        user_id = payload.get("userId")
        
        if not user_id:
            return JSONResponse(status_code=400, content={"error": "userId is required"})
        
        # Get user data
        user_context = await _get_user_context(user_id)
        
        # Analyze patterns using Groq
        system_prompt = """Analyze the user's recent patterns for early warning signs of mental health concerns.
Consider: journal sentiment trends, task completion rates, sleep patterns, and voice analysis history.

Provide a JSON response with:
- level: "green", "yellow", "orange", or "red"
- message: A brief, compassionate message (1-2 sentences)
- recommendation: What the user should consider doing

IMPORTANT: Do NOT diagnose conditions. Provide gentle, supportive guidance.
If concerning patterns exist, suggest "speaking with a mental health professional might provide additional support."
This is NOT a diagnosis - just a thoughtful suggestion based on patterns observed."""

        user_data_summary = f"""User Profile:
- Name: {user_context.get('name', 'User')}
- Occupation: {user_context.get('occupation', 'Not specified')}
- Sleep: {user_context.get('sleep', 'Not specified')}
- Activity: {user_context.get('activity', 'Not specified')}

Recent Journal Entries: {user_context.get('recent_journals', 'No entries')}

Recent Tasks: {user_context.get('recent_tasks', 'No tasks')}"""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_data_summary}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        result_text = chat_completion.choices[0].message.content if chat_completion.choices else "{}"
        
        try:
            result = json.loads(result_text)
        except json.JSONDecodeError:
            result = {
                "level": "green",
                "message": "You're doing great! Keep up the good work.",
                "recommendation": "Continue your current practices."
            }
        
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Analysis failed: {str(e)}"})


@app.get("/api/user/profile")
async def get_user_profile(userId: str = Query(default="")):
    """Get user profile data from onboarding."""
    if not userId:
        return JSONResponse(status_code=400, content={"error": "userId is required"})
    
    try:
        user_context = await _get_user_context(userId)
        return user_context
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to get profile: {str(e)}"})


async def _get_user_context(user_id: str) -> dict:
    """Get comprehensive user context for AI analysis."""
    try:
        journals, _, tasks = _get_collections()
        
        # Get recent journals
        recent_journals = list(journals.find(
            {"userId": user_id}
        ).sort("date", DESCENDING).limit(5))
        
        journal_texts = []
        for j in recent_journals:
            title = j.get('title', '')
            content = j.get('content', '')
            if title or content:
                journal_texts.append(f"- {title}: {content}"[:200])
        
        # Get recent tasks
        recent_tasks = list(tasks.find(
            {"userId": user_id}
        ).sort("date", DESCENDING).limit(10))
        
        task_summary = []
        for t in recent_tasks:
            status = t.get('status', 'pending')
            title = t.get('title', 'Untitled')
            task_summary.append(f"- {title} ({status})")
        
        return {
            "userId": user_id,
            "name": "User",
            "occupation": "Not specified",
            "sleep": "Not specified",
            "activity": "Not specified",
            "recent_journals": "\n".join(journal_texts) if journal_texts else "No recent entries",
            "recent_tasks": "\n".join(task_summary) if task_summary else "No recent tasks"
        }
    except Exception:
        return {
            "userId": user_id,
            "name": "User",
            "occupation": "Not specified",
            "recent_journals": "Unable to retrieve",
            "recent_tasks": "Unable to retrieve"
        }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)
