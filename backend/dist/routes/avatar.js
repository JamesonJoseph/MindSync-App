import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appPaths, env } from "../config/env.js";
import { serializeDocuments } from "../lib/serialization.js";
import { AvatarConversationModel } from "../models/avatar-conversation.js";
import { requireAuth } from "../plugins/auth.js";
import { analyzeEarlyWarning, analyzeVoiceTranscript, runAvatarChat } from "../services/avatar.js";
import { detectEmotionFromImage } from "../services/emotion.js";
import { sarvamService } from "../services/sarvam.js";
export const avatarRoutes = async (app) => {
    app.post("/api/avatar/chat", { preHandler: requireAuth }, async (request) => {
        const payload = request.body;
        return runAvatarChat({
            uid: request.auth.uid,
            email: request.auth.email,
            message: String(payload.message ?? ""),
            languageHint: typeof payload.languageCode === "string" ? payload.languageCode : undefined,
        });
    });
    app.get("/api/avatar/history", { preHandler: requireAuth }, async (request) => {
        const docs = await AvatarConversationModel.find({ userId: request.auth.uid }).sort({ date: -1 }).limit(50).lean();
        return serializeDocuments(docs);
    });
    app.post("/api/avatar/analyze-voice", { preHandler: requireAuth }, async (request, reply) => {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: "audio is required" });
        }
        const buffer = await file.toBuffer();
        const tmpPath = path.join(appPaths.tempDir, `${randomUUID()}.audio`);
        await fs.writeFile(tmpPath, buffer);
        try {
            const sttResult = await sarvamService.transcribeShortAudio({
                filePath: tmpPath,
                mode: env.SARVAM_STT_MODE,
                languageCode: "unknown",
                withDiarization: false,
            });
            const transcript = String(sttResult.transcript ?? sttResult.text ?? sttResult.transcript_text ?? "");
            const analysis = await analyzeVoiceTranscript({
                uid: request.auth.uid,
                email: request.auth.email,
                transcript,
                languageCode: typeof sttResult.language_code === "string" ? sttResult.language_code : "unknown",
            });
            return {
                ...analysis,
                stt: {
                    mode: "short",
                    jobId: sttResult.job_id ?? null,
                    languageCode: typeof sttResult.language_code === "string" ? sttResult.language_code : "unknown",
                },
            };
        }
        finally {
            await fs.rm(tmpPath, { force: true });
        }
    });
    app.post("/api/avatar/tts", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const text = String(payload.text ?? "");
        if (!text.trim()) {
            return reply.code(400).send({ error: "Text is required" });
        }
        return sarvamService.synthesizeText({
            text,
            speaker: typeof payload.voice_id === "string" ? payload.voice_id : undefined,
            languageCode: typeof payload.languageCode === "string" ? payload.languageCode : env.SARVAM_TTS_DEFAULT_LANGUAGE,
            pace: typeof payload.pace === "number" ? payload.pace : env.SARVAM_TTS_DEFAULT_PACE,
        });
    });
    app.post("/api/avatar/early-warning", async (request, reply) => {
        const payload = request.body;
        const userId = String(payload.userId ?? "");
        if (!userId) {
            return reply.code(400).send({ error: "userId is required" });
        }
        return analyzeEarlyWarning(userId);
    });
    app.post("/api/emotion", { preHandler: requireAuth }, async (request, reply) => {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: "image is required" });
        }
        const imageBase64 = (await file.toBuffer()).toString("base64");
        return detectEmotionFromImage({
            userId: request.auth.uid,
            userEmail: request.auth.email,
            mimeType: file.mimetype,
            imageBase64,
        });
    });
};
