import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().default("karthu"),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  REDIS_URL: z.string().optional(),
  SARVAM_API_KEY: z.string().min(1, "SARVAM_API_KEY is required"),
  SARVAM_STT_MODEL: z.string().default("saaras:v3"),
  SARVAM_STT_MODE: z.string().default("transcribe"),
  SARVAM_TTS_MODEL: z.string().default("bulbul:v3"),
  SARVAM_TTS_DEFAULT_SPEAKER: z.string().default("Shubh"),
  SARVAM_TTS_DEFAULT_LANGUAGE: z.string().default("en-IN"),
  SARVAM_TTS_DEFAULT_FORMAT: z.string().default("wav"),
  SARVAM_TTS_DEFAULT_PACE: z.coerce.number().default(0.98),
  SARVAM_TTS_TEMPERATURE: z.coerce.number().default(0.7),
  SARVAM_TTS_SAMPLE_RATE: z.coerce.number().int().default(48000),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  ALLOW_HEADER_AUTH_FALLBACK: z.coerce.boolean().default(true),
  ANALYZE_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  CACHE_TTL_ANALYZE_SECONDS: z.coerce.number().int().positive().default(900),
  CACHE_TTL_CHAT_SECONDS: z.coerce.number().int().positive().default(600),
  CACHE_TTL_STT_SECONDS: z.coerce.number().int().positive().default(86400),
  CACHE_TTL_TTS_SECONDS: z.coerce.number().int().positive().default(604800),
  UPLOADS_DIR: z.string().default("uploads"),
  TEMP_DIR: z.string().default("tmp"),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const appPaths = {
  root: process.cwd(),
  uploadsDir: path.resolve(process.cwd(), env.UPLOADS_DIR),
  tempDir: path.resolve(process.cwd(), env.TEMP_DIR),
  promptsDir: path.resolve(process.cwd(), "prompts"),
};
