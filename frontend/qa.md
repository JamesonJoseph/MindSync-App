# Frontend API Endpoint Analysis Q&A

## Q1. How does the frontend decide which backend base URL to use?
**Answer:** The shared network helper in `utils/api.ts` resolves the backend base URL from two candidates:

1. The Expo host IP on port `5000`.
2. `EXPO_PUBLIC_API_URL`.

It removes trailing slashes, de-duplicates candidates, and retries alternate base URLs when a request returns a non-JSON server error page. Relative paths like `/api/journals` are expanded automatically by `authFetch`.

## Q2. What headers does the frontend automatically send on authenticated requests?
**Answer:** Most mobile/frontend API calls use `authFetch` from `utils/api.ts`. That helper adds:

- `Authorization: Bearer <Firebase ID token>` when a Firebase user exists
- `X-User-Id: <firebase uid>`
- `X-User-Email: <firebase email>` when available

It preserves any request-specific headers such as `Content-Type` or `Accept`.

Important exceptions:

- `app/home.tsx` uses raw `fetch` for `/api/emotion`, so it does **not** send the Firebase token or the `X-User-*` headers.
- `components/TaskManager/App.jsx` uses raw `fetch` and sends only `Authorization` when Firebase is available. It does **not** send `X-User-Id` or `X-User-Email`.
- `app/docs.tsx` downloads PDFs with `FileSystem.downloadAsync`, manually attaching `Authorization`, `X-User-Id`, and optional `X-User-Email`.

## Q3. Which unique backend endpoints are used by the frontend?
**Answer:** I found these unique endpoints used directly in the frontend code:

1. `POST /api/avatar/analyze-voice`
2. `GET /api/avatar/history`
3. `POST /api/analyze`
4. `GET /api/journals`
5. `POST /api/journals`
6. `PUT /api/journals/:id`
7. `DELETE /api/journals/:id`
8. `GET /api/journals/search`
9. `GET /api/tasks`
10. `POST /api/tasks`
11. `PUT /api/tasks/:id`
12. `DELETE /api/tasks/:id`
13. `GET /api/birthdays`
14. `POST /api/birthdays`
15. `GET /api/events`
16. `POST /api/events`
17. `POST /api/emotion`
18. `GET /api/chat/conversations`
19. `GET /api/chat/conversations/:id`
20. `PUT /api/chat/conversations/:id`
21. `DELETE /api/chat/conversations/:id`
22. `POST /api/chat`
23. `POST /api/chat/save`
24. `GET /api/documents`
25. `POST /api/documents`
26. `PUT /api/documents/:id`
27. `DELETE /api/documents/:id`
28. `DELETE /api/documents/file?path=...`
29. `POST /api/documents/upload-pdf`

## Q4. What does `POST /api/avatar/analyze-voice` send?
**Answer:** This endpoint is used in two flows:

### 4.1 Journal voice-to-text flow
Used by: `app/add-journal.tsx`

Method: `POST`

Body: `FormData`

Sent fields:

- `audio`: recorded journal audio file
  - `uri`: local recording URI
  - `name`: `journal-recording.m4a`
  - `type`: `audio/m4a`

Headers:

- `Accept: application/json`
- plus auth headers from `authFetch`

Expected response usage:

- Reads `transcript`
- May also read `error` or `detail`

### 4.2 Avatar conversational voice analysis flow
Used by: `app/avatar.tsx`

Method: `POST`

Body: `FormData`

Sent fields:

- `audio`: recorded file
  - `uri`: local recording URI
  - `name`: `recording.m4a`
  - `type`: `audio/m4a`
- `userId`: current Firebase UID or `'anonymous'`
- `userEmail`: current Firebase email or fallback `'anonymous@example.com'`

Headers:

- `Accept: application/json`
- plus auth headers from `authFetch`

Expected response usage:

- `transcript`
- `emotion`
- `confidence`
- `suggestions`
- `earlyWarning`

## Q5. What does `GET /api/avatar/history` do?
**Answer:** Used by `app/avatar.tsx` to load past avatar conversations.

Method: `GET`

Query params: none

Body: none

Headers:

- auth headers from `authFetch`

Expected response shape consumed by frontend:

- array of conversation/history items containing fields like `_id`, `user_query`, `assistant_response`, `date`, `userEmail`

## Q6. What does `POST /api/analyze` send?
**Answer:** Used by `app/add-journal.tsx` to generate AI analysis for the journal draft.

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "content": "<journal text>"
}
```

Frontend usage of response:

- reads `analysis`
- on failure reads `error` or `detail`

## Q7. What does the journal API send and receive?
**Answer:** Journal screens use four journal endpoints.

### 7.1 `GET /api/journals`
Used by: `app/journal.tsx`

Method: `GET`

Query params:

- `userId=<firebase uid>`

Body: none

Headers:

- auth headers from `authFetch`

Frontend expects an array and maps:

- `_id`
- `date`
- `title`
- `content`
- `aiAnalysis`

### 7.2 `POST /api/journals`
Used by: `app/add-journal.tsx` when creating a journal

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "userEmail": "<firebase email or null>",
  "title": "Entry for <Month Day, Year>",
  "content": "<journal content>",
  "aiAnalysis": "<analysis text>"
}
```

### 7.3 `PUT /api/journals/:id`
Used by: `app/add-journal.tsx` when editing an existing journal

Method: `PUT`

Path param:

- `:id` = existing journal ID from route params

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body is the same shape as create:

```json
{
  "userId": "<firebase uid>",
  "userEmail": "<firebase email or null>",
  "title": "Entry for <Month Day, Year>",
  "content": "<journal content>",
  "aiAnalysis": "<analysis text>"
}
```

### 7.4 `DELETE /api/journals/:id`
Used by: `app/journal.tsx`

Method: `DELETE`

Path param:

- `:id` = journal ID

Body: none

Headers:

- auth headers from `authFetch`

## Q8. What does `GET /api/journals/search` send?
**Answer:** Used by `app/chat.tsx` to preload recent journals for chat continuation.

Method: `GET`

Query params:

- `limit=5`
- `sort=desc`

Body: none

Headers:

- auth headers from `authFetch`

Frontend expects an array with fields such as:

- `_id`
- `title`
- `content`
- `aiAnalysis`
- `date`

## Q9. What does the task API send?
**Answer:** Task endpoints are used by multiple screens:

- `app/tasks.tsx`
- `app/task-manager.tsx`
- `app/add-task.tsx`
- `components/TaskManager/App.jsx` (legacy web/task manager)

This means the same route is called with slightly different payloads.

### 9.1 `GET /api/tasks`
Used by:

- `app/tasks.tsx`
- `app/task-manager.tsx`
- `components/TaskManager/App.jsx`

Method: `GET`

Body: none

Headers:

- `authFetch` users send auth headers
- legacy component sends `Content-Type: application/json` and optionally `Authorization`

Frontend expects task arrays containing fields like:

- `_id`
- `id`
- `title`
- `description`
- `status`
- `priority`
- `date`
- `event_datetime`
- `time`
- `type`
- `allDay`
- `reminder_minutes`
- `reminder_datetime`
- `created_at`

### 9.2 `POST /api/tasks`
There are four different payload shapes.

#### A. Calendar/tasks screen optimistic create
Used by: `app/tasks.tsx`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "title": "<task title>",
  "description": "<task description>",
  "priority": "high | medium | low",
  "event_datetime": "<IST ISO string>",
  "time": "<selected time or empty string>",
  "type": "task",
  "allDay": true,
  "reminder_minutes": 30,
  "status": "pending"
}
```

#### B. Add-task screen create
Used by: `app/add-task.tsx`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "title": "<task title>",
  "description": "<task description>",
  "priority": "high | medium | low",
  "event_datetime": "<IST ISO string>",
  "time": "<selected time or empty string>",
  "type": "task",
  "allDay": true,
  "reminder_minutes": 30,
  "status": "pending"
}
```

Note: `reminder_minutes` can vary from the reminder picker, not always `30`.

#### C. General task manager create
Used by: `app/task-manager.tsx`

JSON body:

```json
{
  "_id": "",
  "id": "<existing id or Date.now()>",
  "title": "<title>",
  "type": "task | event | birthday",
  "allDay": true,
  "event_datetime": "<IST ISO string>",
  "reminder_minutes": 30,
  "status": "pending",
  "created_at": "<ISO timestamp>"
}
```

This screen uses `/api/tasks` as a generic item store for tasks, events, and birthdays.

#### D. Legacy web task manager create
Used by: `components/TaskManager/App.jsx`

JSON body:

- whatever `taskData` the web modal constructs

From the surrounding code, this likely includes:

- `id`
- `title`
- `type`
- `allDay`
- `event_datetime`
- `reminder_minutes`
- `status`
- possibly `reminder_datetime`

### 9.3 `PUT /api/tasks/:id`
Used by:

- `app/tasks.tsx`
- `app/task-manager.tsx`
- `components/TaskManager/App.jsx`

Payloads vary by action.

#### A. Full-ish edit from `app/tasks.tsx`

```json
{
  "title": "<task title>",
  "description": "<task description>",
  "priority": "high | medium | low"
}
```

#### B. Status toggle from `app/tasks.tsx`

```json
{
  "status": "pending | completed"
}
```

#### C. Full-ish edit from `app/task-manager.tsx`

```json
{
  "_id": "<existing or empty>",
  "id": "<existing id>",
  "title": "<title>",
  "type": "task | event | birthday",
  "allDay": true,
  "event_datetime": "<IST ISO string>",
  "reminder_minutes": 30,
  "status": "pending | completed",
  "created_at": "<ISO timestamp>"
}
```

#### D. Status toggle from `app/task-manager.tsx`

```json
{
  "status": "pending | completed"
}
```

#### E. Legacy web update from `components/TaskManager/App.jsx`

- sends the entire `taskData` object passed from the modal

### 9.4 `DELETE /api/tasks/:id`
Used by:

- `app/tasks.tsx`
- `app/task-manager.tsx`
- `components/TaskManager/App.jsx`

Method: `DELETE`

Body: none

Headers:

- authenticated on mobile screens
- legacy web sends optional `Authorization`

## Q10. What do birthday and event APIs send?
**Answer:** These are separate endpoints on the main calendar UI, but `app/task-manager.tsx` also stores event and birthday-like items through `/api/tasks`.

### 10.1 `GET /api/birthdays`
Used by: `app/tasks.tsx`

Method: `GET`

Body: none

Headers:

- auth headers from `authFetch`

Frontend expects array items with:

- `_id`
- `name`
- `date`
- `monthDay`
- `year`
- `relation`
- `color`

### 10.2 `POST /api/birthdays`
Used by: `app/add-birthday.tsx`

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "name": "<person name>",
  "relation": "<relation>",
  "date": "<IST ISO string for selected day>",
  "color": "<selected hex color>",
  "notifications": [
    "On the day at 9:00 AM",
    "1 week before at 9:00 AM"
  ]
}
```

### 10.3 `GET /api/events`
Used by: `app/tasks.tsx`

Method: `GET`

Body: none

Headers:

- auth headers from `authFetch`

Frontend expects array items with:

- `_id`
- `title`
- `date`
- `time`
- `color`

### 10.4 `POST /api/events`
Used by: `app/add-event.tsx`

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "title": "<event title>",
  "description": "<event description>",
  "date": "<IST ISO string>",
  "time": "<selected time or empty string>",
  "color": "<selected hex color>"
}
```

## Q11. What does `POST /api/emotion` send?
**Answer:** It is used in two places.

### 11.1 Explicit emotion analysis screen
Used by: `app/emotion.tsx`

Method: `POST`

Body: `FormData`

Sent fields:

- `image`
  - `uri`: local image URI
  - `name`: `selfie.jpg`
  - `type`: `image/jpeg`
- `userId`: current Firebase UID or empty string
- `userEmail`: current Firebase email or empty string

Headers:

- `Accept: application/json`
- plus auth headers from `authFetch`

Frontend expects:

- `emotion`
- `confidence`
- `details`

### 11.2 Background mood detection on home screen
Used by: `app/home.tsx`

Method: `POST`

Body: `FormData`

Sent fields:

- `image`
  - `uri`: captured photo URI
  - `name`: derived from local filename
  - `type`: derived image MIME type
- `userId`
- `userEmail`

Headers:

- no explicit auth headers because raw `fetch` is used

Frontend expects:

- `emotion`
- `details`

## Q12. What does the chat conversation listing API send?
**Answer:** There are two listing variants.

### 12.1 `GET /api/chat/conversations`
Used by: `app/chat-history.tsx`

Method: `GET`

Body: none

Headers:

- auth headers from `authFetch`

Expected response items:

- `_id`
- `title`
- `contextType`
- `messageCount`
- `lastMessage`
- `updatedAt`

### 12.2 `GET /api/chat/conversations?limit=5`
Used by: `app/chat.tsx`

Method: `GET`

Query params:

- `limit=5`

Body: none

Headers:

- auth headers from `authFetch`

Purpose:

- loads recent chats for the chat home screen

## Q13. What does `GET /api/chat/conversations/:id` send?
**Answer:** Used by `app/chat.tsx` when opening a saved conversation.

Method: `GET`

Path param:

- `:id` = conversation ID

Body: none

Headers:

- auth headers from `authFetch`

Frontend expects a response containing at least:

- `messages`
- possibly `_id`, `title`, `contextType`, `context`, `updatedAt`

Each message is expected to have:

- `role`
- `content`

## Q14. What does `POST /api/chat` send?
**Answer:** Used by `app/chat.tsx` to request an assistant reply.

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "userId": "<firebase uid>",
  "messages": [
    {
      "role": "user | assistant",
      "content": "<message text>"
    }
  ]
}
```

Frontend expects:

- `content` for the assistant reply
- on failure reads `error` or `detail`

## Q15. What does `POST /api/chat/save` send?
**Answer:** Used by `app/chat.tsx` to persist conversations.

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "conversationId": "<existing id or undefined>",
  "contextType": "<journal | general | undefined>",
  "context": {
    "...": "screen-specific context object"
  },
  "messages": [
    {
      "role": "user | assistant",
      "content": "<message text>"
    }
  ]
}
```

Context examples seen in routing logic:

- journal title
- journal ID
- journal content
- journal analysis
- source marker like `add-journal` or `chat-previous-journal`

Frontend expects response fields such as:

- `_id`
- `title`
- `contextType`
- `messages`
- `updatedAt`

## Q16. What do `PUT /api/chat/conversations/:id` and `DELETE /api/chat/conversations/:id` send?
**Answer:** They are used by both `app/chat.tsx` and `app/chat-history.tsx`.

### 16.1 `PUT /api/chat/conversations/:id`
Purpose:

- rename a conversation

Method: `PUT`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "title": "<new conversation title>"
}
```

### 16.2 `DELETE /api/chat/conversations/:id`
Purpose:

- delete a saved conversation

Method: `DELETE`

Body: none

Headers:

- auth headers from `authFetch`

## Q17. What does the documents/vault API send?
**Answer:** The vault layer uses these endpoints:

- `GET /api/documents`
- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `DELETE /api/documents/file?path=...`
- `POST /api/documents/upload-pdf`

### 17.1 `GET /api/documents`
Used by: `app/contexts/VaultContext.tsx`

Method: `GET`

Body: none

Headers:

- auth headers from `authFetch`

Purpose:

- fetch encrypted vault documents from backend

Frontend filters returned docs by:

- `type === 'vault'`
- `type === 'secure-doc'`

Then decrypts each doc’s `content`.

### 17.2 `POST /api/documents`
Used by: `app/contexts/VaultContext.tsx` when adding a vault entry

Method: `POST`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "title": "<entry title>",
  "content": "<encrypted serialized entry>",
  "type": "secure-doc"
}
```

Expected response:

- at least `_id` so the local vault entry can be linked to backend state

### 17.3 `PUT /api/documents/:id`
Used by: `app/contexts/VaultContext.tsx` when updating an existing vault entry

Method: `PUT`

Headers:

- `Content-Type: application/json`
- plus auth headers from `authFetch`

JSON body:

```json
{
  "title": "<updated title>",
  "content": "<encrypted serialized entry>",
  "type": "secure-doc"
}
```

### 17.4 `DELETE /api/documents/:id`
Used by: `app/contexts/VaultContext.tsx`

Method: `DELETE`

Body: none

Headers:

- auth headers from `authFetch`

Purpose:

- remove the secure document metadata row

### 17.5 `DELETE /api/documents/file?path=...`
Used by: `app/contexts/VaultContext.tsx`

Method: `DELETE`

Query params:

- `path=<encoded storage path>`

Body: none

Headers:

- auth headers from `authFetch`

Purpose:

- remove a stored PDF/blob file before deleting its metadata entry

### 17.6 `POST /api/documents/upload-pdf`
Used by: `app/docs.tsx`

Method: `POST`

Body: `FormData`

Sent fields:

- `file`
  - `uri`: local PDF asset URI
  - `name`: sanitized file name
  - `type`: stored MIME type or `application/pdf`

Headers:

- plus auth headers from `authFetch`
- no explicit `Content-Type`, letting multipart boundaries be generated automatically

Expected response usage:

- `storagePath`
- `downloadUrl`

Those values are then copied into the vault entry payload stored via `addEntry` and later synced to `/api/documents`.

## Q18. Does the frontend ever use server-generated file URLs directly?
**Answer:** Yes. In `app/docs.tsx`, after `POST /api/documents/upload-pdf`, the frontend stores:

- `downloadUrl` into the vault entry’s `url`
- `storagePath` into the vault entry’s `storagePath`

Later, when a user opens a PDF, the app downloads from:

- `entry.url` directly if it already starts with `http`
- otherwise it prefixes the backend base URL

That means the actual file download endpoint may be dynamic and is not a fixed hardcoded route in the frontend.

## Q19. Which endpoints are duplicated across multiple frontend screens?
**Answer:** The most duplicated routes are:

- `/api/tasks`
  - used by `app/tasks.tsx`
  - used by `app/task-manager.tsx`
  - used by `app/add-task.tsx`
  - used by `components/TaskManager/App.jsx`

- `/api/tasks/:id`
  - used by `app/tasks.tsx`
  - used by `app/task-manager.tsx`
  - used by `components/TaskManager/App.jsx`

- `/api/chat/conversations/:id`
  - used by `app/chat.tsx`
  - used by `app/chat-history.tsx`

- `/api/avatar/analyze-voice`
  - used by `app/add-journal.tsx`
  - used by `app/avatar.tsx`

- `/api/emotion`
  - used by `app/emotion.tsx`
  - used by `app/home.tsx`

## Q20. What inconsistencies or integration risks exist in the current frontend API usage?
**Answer:** I found several noteworthy risks.

### 20.1 Mixed payload contracts for `/api/tasks`
Different screens send different schemas to the same endpoint:

- some send `userId`, `description`, `priority`
- some send `type` values other than `task`
- some send `id` and `_id`
- some only send `{ status }`

This implies the backend must be permissive or branch by caller.

### 20.2 Mixed identifier usage for `/api/tasks/:id`
Some screens use:

- `_id`

Others use:

- `id`

If the backend expects only one identifier type, some updates/deletes may fail.

### 20.3 `/api/emotion` is not consistently authenticated
`app/emotion.tsx` uses `authFetch`, but `app/home.tsx` uses raw `fetch`.

### 20.4 The legacy web task manager does not match the mobile auth pattern
`components/TaskManager/App.jsx` sends optional `Authorization`, but not `X-User-Id` or `X-User-Email`.

### 20.5 Journal GET mixes auth header and query-string identity
`GET /api/journals` includes auth headers and also sends `userId` in the query string.

### 20.6 Vault data is encrypted client-side before storage
This is intentional, but it means backend search/indexing on vault content is effectively impossible unless it operates on metadata only.

## Q21. Which files contain the active API usage?
**Answer:** These are the main files with direct backend calls:

- `utils/api.ts`
- `app/add-journal.tsx`
- `app/journal.tsx`
- `app/chat.tsx`
- `app/chat-history.tsx`
- `app/tasks.tsx`
- `app/task-manager.tsx`
- `app/add-task.tsx`
- `app/add-event.tsx`
- `app/add-birthday.tsx`
- `app/emotion.tsx`
- `app/home.tsx`
- `app/avatar.tsx`
- `app/contexts/VaultContext.tsx`
- `app/docs.tsx`
- `components/TaskManager/App.jsx`

## Q22. What is the final high-level conclusion?
**Answer:** The frontend is built around a shared authenticated fetch helper and a backend on port `5000`, but the codebase contains multiple overlapping clients for the same resources, especially tasks and chat history. The API surface is not small, but it is understandable:

- journal APIs handle journaling and AI analysis
- task/birthday/event APIs drive scheduling
- chat APIs handle assistant conversations and persistence
- avatar/emotion APIs handle voice and camera-based analysis
- documents APIs back the secure vault and PDF upload flow

The biggest integration complexity is not the number of endpoints. It is the inconsistent request shapes sent to the same endpoint family, especially `/api/tasks`.
