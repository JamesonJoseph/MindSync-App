# MindSync App - AI-Powered Emotional Well-being Assistant

## Project Overview
MindSync is a full-stack mobile application designed to help users track their emotional well-being through AI-enhanced journaling and real-time facial emotion detection.

- **Frontend:** React Native (Expo) using TypeScript and Expo Router.
- **Backend:** FastAPI (Python) providing a RESTful API for journaling, sentiment analysis, and emotion detection.
- **AI Integration:** 
  - **Groq (Llama 3.1):** Used for empathetic analysis of journal entries.
  - **Google Gemini (Flash):** Used for analyzing micro-expressions in facial images to detect emotions.
- **Database:** MongoDB (via PyMongo) for storing journal entries and emotion history.
- **Authentication:** Firebase is configured on the frontend for user management.

---

## Project Structure

### Backend (`/backend`)
- `app.py`: Main FastAPI application containing routes for CRUD operations on journals, AI analysis, and emotion detection.
- `requirements.txt`: Python dependencies (FastAPI, uvicorn, pymongo, groq, httpx, etc.).
- `.env`: Environment variables for MongoDB URI, API keys (Groq, Gemini), and server configuration.

### Frontend (`/frontend`)
- `app/`: Expo Router directory containing the application's screens (`index`, `home`, `journal`, `add-journal`, `emotion`).
- `utils/api.ts`: API client configuration, fetching the base URL from environment variables.
- `firebaseConfig.ts`: Firebase initialization for authentication and other services.
- `package.json`: NPM dependencies and scripts for running the Expo app.

---

## Building and Running

### Prerequisites
- Python 3.10+
- Node.js & npm/yarn
- MongoDB instance (Atlas or local)
- API Keys for Groq and Google Gemini

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure `.env` with `MONGO_URI`, `GROQ_API_KEY`, and `GEMINI_API_KEY`.
5. Run the server:
   ```bash
   python app.py
   ```
   The backend will be available at `http://localhost:5000` (or the port specified in `.env`).

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env` with `EXPO_PUBLIC_API_URL` (pointing to your backend) and Firebase credentials.
4. Start the Expo development server:
   ```bash
   npm start
   ```
   Press `a` for Android, `i` for iOS, or `w` for web.

---

## Development Conventions

### Backend
- **Framework:** FastAPI with asynchronous support for AI API calls.
- **Database:** Documents are serialized using `_serialize_doc` to convert `ObjectId` and `datetime` to JSON-friendly formats.
- **AI Logic:** Isolated helper functions like `_analyze_with_gemini` handle communication with external AI services.

### Frontend
- **Routing:** Uses `expo-router` for file-based routing.
- **State Management:** Mix of local state and Firebase for persistence.
- **Styling:** Likely standard React Native `StyleSheet` (can be confirmed by reading screen files).
- **Environment Variables:** All public-facing variables must be prefixed with `EXPO_PUBLIC_`.

### Testing
- No explicit test suite was found. TODO: Implement unit tests for backend routes and component tests for the frontend.
