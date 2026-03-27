import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { appPaths, env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { serializeDocuments } from "../lib/serialization.js";
import { AvatarConversationModel } from "../models/avatar-conversation.js";
import { requireAuth, resolveAuth } from "../plugins/auth.js";
import { analyzeEarlyWarning, analyzeVoiceTranscript, runAvatarChat } from "../services/avatar.js";
import { detectEmotionFromImage } from "../services/emotion.js";
import { sarvamService } from "../services/sarvam.js";

const supportedSpeechLanguages = new Set(["en-IN", "ml-IN", "hi-IN", "ta-IN", "te-IN", "kn-IN"]);

function readMultipartField(
  fields: Record<string, { value?: unknown } | { fields?: unknown }> | undefined,
  key: string,
): string | undefined {
  const raw = (fields as Record<string, { value?: unknown }> | undefined)?.[key]?.value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function normalizeSpeechLanguageCode(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return supportedSpeechLanguages.has(normalized) ? normalized : undefined;
}

export const avatarRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/avatar/chat", { preHandler: requireAuth }, async (request) => {
    const payload = request.body as Record<string, unknown>;
    logger.info("Avatar chat request", {
      requestId: request.id,
      uid: request.auth.uid,
      hasLanguageCode: typeof payload.languageCode === "string",
      messageLength: String(payload.message ?? "").trim().length,
    });

    return runAvatarChat({
      uid: request.auth.uid,
      email: request.auth.email,
      message: String(payload.message ?? ""),
      languageHint: typeof payload.languageCode === "string" ? payload.languageCode : undefined,
    });
  });

  app.get("/api/avatar/history", { preHandler: requireAuth }, async (request) => {
    logger.info("Avatar history request", {
      requestId: request.id,
      uid: request.auth.uid,
    });
    const docs = await AvatarConversationModel.find({ userId: request.auth.uid }).sort({ date: -1 }).limit(50).lean();
    return serializeDocuments(docs);
  });

  app.post("/api/avatar/analyze-voice", { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "audio is required" });
    }

    const requestedLanguageCode = normalizeSpeechLanguageCode(
      readMultipartField(file.fields as Record<string, { value?: unknown }> | undefined, "languageCode")
        ?? readMultipartField(file.fields as Record<string, { value?: unknown }> | undefined, "language")
        ?? (typeof request.headers["x-language-code"] === "string" ? request.headers["x-language-code"] : undefined),
    );

    const buffer = await file.toBuffer();
    logger.info("Avatar voice upload received", {
      requestId: request.id,
      uid: request.auth.uid,
      fieldName: file.fieldname,
      filename: file.filename,
      mimeType: file.mimetype,
      sizeBytes: buffer.length,
      requestedLanguageCode: requestedLanguageCode ?? "auto",
    });

    const tmpPath = path.join(appPaths.tempDir, `${randomUUID()}.audio`);
    await fs.writeFile(tmpPath, buffer);

    try {
      const sttResult = await sarvamService.transcribeShortAudio({
        filePath: tmpPath,
        mode: env.SARVAM_STT_MODE,
        languageCode: requestedLanguageCode,
        withDiarization: false,
      });

      const transcript = String(sttResult.transcript ?? sttResult.text ?? sttResult.transcript_text ?? "");
      const detectedLanguageCode = normalizeSpeechLanguageCode(
        typeof sttResult.language_code === "string" ? sttResult.language_code : requestedLanguageCode,
      );
      logger.info("Avatar speech transcription complete", {
        requestId: request.id,
        uid: request.auth.uid,
        transcriptLength: transcript.trim().length,
        detectedLanguageCode: detectedLanguageCode ?? "unknown",
        sttJobId: sttResult.job_id ?? null,
      });

      const analysis = await analyzeVoiceTranscript({
        uid: request.auth.uid,
        email: request.auth.email,
        transcript,
        languageCode: detectedLanguageCode,
      });

      return {
        ...analysis,
        stt: {
          mode: "short",
          jobId: sttResult.job_id ?? null,
          languageCode: detectedLanguageCode ?? "unknown",
        },
      };
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
  });

  app.post("/api/avatar/tts", { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    const text = String(payload.text ?? "");
    if (!text.trim()) {
      return reply.code(400).send({ error: "Text is required" });
    }

    logger.info("Avatar TTS request", {
      requestId: request.id,
      uid: request.auth.uid,
      textLength: text.trim().length,
      languageCode: typeof payload.languageCode === "string" ? payload.languageCode : env.SARVAM_TTS_DEFAULT_LANGUAGE,
      voiceId: typeof payload.voice_id === "string" ? payload.voice_id : undefined,
    });

    return sarvamService.synthesizeText({
      text,
      speaker: typeof payload.voice_id === "string" ? payload.voice_id : undefined,
      languageCode: typeof payload.languageCode === "string" ? payload.languageCode : env.SARVAM_TTS_DEFAULT_LANGUAGE,
      pace: typeof payload.pace === "number" ? payload.pace : env.SARVAM_TTS_DEFAULT_PACE,
    });
  });

  app.post("/api/avatar/early-warning", async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    const userId = String(payload.userId ?? "");
    if (!userId) {
      return reply.code(400).send({ error: "userId is required" });
    }

    return analyzeEarlyWarning(userId);
  });

  app.post("/api/emotion", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "image is required" });
    }

    const auth = await resolveAuth(request);
    const bodyUserId = readMultipartField(file.fields as Record<string, { value?: unknown }> | undefined, "userId");
    const bodyUserEmail = readMultipartField(file.fields as Record<string, { value?: unknown }> | undefined, "userEmail");
    const userId = auth?.uid ?? bodyUserId ?? "anonymous";
    const userEmail = auth?.email ?? bodyUserEmail ?? "";

    const imageBase64 = (await file.toBuffer()).toString("base64");
    return detectEmotionFromImage({
      userId,
      userEmail,
      mimeType: file.mimetype,
      imageBase64,
    });
  });
};
