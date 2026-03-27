# Karthu Backend

This backend replaces the legacy FastAPI app in `Oldcode/app.py` with a TypeScript service built around Fastify, Mongoose, Redis-aware caching, Firebase auth, Groq for text intelligence, Gemini for image emotion detection, and Sarvam for speech-to-text and text-to-speech.

## Stack

- Node.js 22+
- Fastify
- MongoDB with Mongoose
- Redis with in-memory fallback
- Firebase Admin
- Groq SDK for chat and avatar reasoning
- Google GenAI SDK for image emotion detection
- Sarvam SDK for STT and TTS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` or use the generated `.env`.

3. Start the dev server:

```bash
npm run dev
```

4. Build the project:

```bash
npm run build
```

## Required Environment Variables

- `MONGODB_URI`
- `SARVAM_API_KEY`

Important optional variables:
- `REDIS_URL`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_GENAI_API_KEY`
- `GROQ_API_KEY`

## Authentication

Protected routes support:
- `Authorization: Bearer <firebase_id_token>`

Compatibility fallback if enabled:
- `x-user-id`
- `x-user-email`

Frontend fetch helper:

```ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await firebaseAuth.currentUser?.getIdToken();

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody.error ?? `Request failed: ${response.status}`));
  }

  return response.json() as Promise<T>;
}
```

## Endpoints

### Health

`GET /health`

Response:

```json
{ "status": "ok" }
```

### Journals

`GET /api/journals`

`GET /api/journals/search?startDate=<iso>&endDate=<iso>&q=<query>&limit=500&sort=desc`

`POST /api/journals`

```json
{
  "title": "Untitled Entry",
  "content": "Today felt heavy.",
  "sentimentScore": 0,
  "aiAnalysis": ""
}
```

`PUT /api/journals/:journalId`

`DELETE /api/journals/:journalId`

### Journal AI Analysis

`POST /api/analyze`

```json
{
  "content": "I have been feeling stressed and overwhelmed lately."
}
```

Response:

```json
{
  "analysis": "..."
}
```

Frontend notes:
- Good for post-entry reflection
- Debounce during live typing if needed

### Tasks

`GET /api/tasks`

`POST /api/tasks`

```json
{
  "title": "Doctor appointment",
  "description": "Annual checkup",
  "type": "task",
  "allDay": false,
  "event_datetime": "2026-03-27T12:00:00.000Z",
  "reminder_minutes": 30,
  "status": "pending",
  "priority": "medium",
  "time": "5:30 PM"
}
```

`PUT /api/tasks/:taskId`

`DELETE /api/tasks/:taskId`

### Birthdays

`GET /api/birthdays`

`POST /api/birthdays`

```json
{
  "name": "Asha",
  "date": "2026-07-11",
  "year": 1998,
  "relation": "friend",
  "color": "#FF6B6B",
  "notifications": []
}
```

`PUT /api/birthdays/:birthdayId`

`DELETE /api/birthdays/:birthdayId`

### Events

`GET /api/events`

Optional query:
- `date=2026-03-27`

`POST /api/events`

```json
{
  "title": "Family dinner",
  "description": "At home",
  "date": "2026-03-27T19:00:00.000Z",
  "time": "7:00 PM",
  "color": "#FF9500"
}
```

`PUT /api/events/:eventId`

`DELETE /api/events/:eventId`

### Documents

`GET /api/documents`

`POST /api/documents`

```json
{
  "title": "Passport Notes",
  "content": "Renew before July",
  "type": "note"
}
```

`PUT /api/documents/:documentId`

`DELETE /api/documents/:documentId`

#### PDF Upload

`POST /api/documents/upload-pdf`

Content type:
- `multipart/form-data`

Field:
- `file`

Response:

```json
{
  "storagePath": "uid/random_document.pdf",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "fileSize": 12345,
  "downloadUrl": "/api/documents/file?path=uid/random_document.pdf"
}
```

`GET /api/documents/file?path=<storagePath>`

`DELETE /api/documents/file?path=<storagePath>`

Frontend upload example:

```ts
export async function uploadPdf(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/documents/upload-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");
  return response.json();
}
```

### Chat

`POST /api/chat`

```json
{
  "messages": [
    { "role": "user", "content": "Show my tasks for today" }
  ]
}
```

Response:

```json
{
  "role": "assistant",
  "content": "..."
}
```

Frontend notes:
- Send the full conversation array each time
- No streaming support

### Saved Chat Conversations

`POST /api/chat/save`

```json
{
  "conversationId": "",
  "contextType": "general",
  "context": {},
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi" }
  ]
}
```

`GET /api/chat/conversations?limit=100`

`GET /api/chat/conversations/:conversationId`

`PUT /api/chat/conversations/:conversationId`

```json
{
  "title": "Morning check-in"
}
```

`DELETE /api/chat/conversations/:conversationId`

### Avatar Chat

`POST /api/avatar/chat`

```json
{
  "message": "I feel overwhelmed today."
}
```

`GET /api/avatar/history`

Frontend note:
- This route returns Groq-generated text written to be spoken later by TTS

### Avatar Voice Analysis

`POST /api/avatar/analyze-voice`

Content type:
- `multipart/form-data`

Field:
- `file`

Response:

```json
{
  "transcript": "I am really tired today",
  "languageCode": "en-IN",
  "emotion": "frustrated",
  "confidence": 74,
  "suggestions": "That sounds draining. You have been carrying a lot. What feels heaviest right now?",
  "earlyWarning": "",
  "stt": {
    "mode": "short",
    "jobId": null,
    "languageCode": "en-IN"
  }
}
```

Frontend notes:
- This route is intended for short voice-note uploads
- `suggestions` is generated in the same language as the detected voice transcript
- In the voice section, use the voice-driven path only
- No chat fallback is needed in that voice UI

Frontend example:

```ts
export async function analyzeVoice(blob: Blob, token: string) {
  const formData = new FormData();
  formData.append("file", blob, "voice.webm");

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/avatar/analyze-voice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(String(error.error ?? "Voice analysis failed"));
  }

  return response.json();
}
```

### Avatar TTS

`POST /api/avatar/tts`

```json
{
  "text": "Take one slow breath with me.",
  "voice_id": "Shubh",
  "languageCode": "en-IN",
  "pace": 1
}
```

Response:

```json
{
  "audio": "<base64-audio>",
  "format": "wav"
}
```

Frontend notes:
- Convert base64 to `Blob`
- Play with `Audio`
- This is the primary endpoint for frontend voice playback
- Pass the `languageCode` returned by `/api/avatar/analyze-voice` so the spoken reply stays in the user's language

Playback example:

```ts
export function playBase64Audio(audioBase64: string, mimeType = "audio/wav") {
  const binary = atob(audioBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  void audio.play();
  return () => URL.revokeObjectURL(url);
}
```

### Early Warning Analysis

`POST /api/avatar/early-warning`

```json
{
  "userId": "firebase-uid"
}
```

Response:

```json
{
  "level": "yellow",
  "message": "You seem more strained than usual.",
  "recommendation": "Try a lighter day and reach out early if the stress keeps building."
}
```

### Emotion Detection

`POST /api/emotion`

Content type:
- `multipart/form-data`

Field:
- `file`

Current behavior:
- Returns a safe neutral fallback unless a multimodal provider is wired in

### User Profile

`GET /api/user/profile`

`PUT /api/user/profile`

```json
{
  "name": "Chris",
  "occupation": "Engineer",
  "sleep": "6 hours",
  "activity": "Low"
}
```

## Recommended Frontend Module Split

- `api.ts`
- `auth.ts`
- `journals.ts`
- `tasks.ts`
- `documents.ts`
- `chat.ts`
- `avatar.ts`
- `audio.ts`

## Recommended Avatar Voice Flow

1. Record voice in the browser
2. Upload blob to `/api/avatar/analyze-voice`
3. Show `transcript`, `emotion`, and `suggestions`
4. Send `suggestions` and `languageCode` to `/api/avatar/tts`
5. Play returned audio

This is the intended voice-first flow. In that section of the frontend, do not build a chat fallback path.

## Current Limitations

- `/api/emotion` is conservative until a multimodal provider is wired in
- `/api/avatar/analyze-voice` is optimized for short uploads
- Redis is optional; memory cache is used if Redis is absent
