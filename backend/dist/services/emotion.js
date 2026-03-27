import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { loadPrompt } from "../lib/prompts.js";
import { EmotionHistoryModel } from "../models/emotion-history.js";
const geminiClient = env.GOOGLE_GENAI_API_KEY ? new GoogleGenAI({ apiKey: env.GOOGLE_GENAI_API_KEY }) : null;
export async function detectEmotionFromImage(input) {
    const fallback = {
        emotion: "neutral",
        confidence: 0,
        details: "Gemini image emotion detection is not configured, so the server returned a safe neutral fallback.",
    };
    if (!geminiClient) {
        await EmotionHistoryModel.create({
            userId: input.userId,
            userEmail: input.userEmail,
            ...fallback,
            date: new Date(),
        });
        return fallback;
    }
    try {
        const response = await geminiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: loadPrompt("emotion-analysis.md") },
                        {
                            inlineData: {
                                mimeType: input.mimeType,
                                data: input.imageBase64,
                            },
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: "application/json",
            },
        });
        const text = String(response.text ?? response.outputText ?? "");
        const parsed = JSON.parse(text);
        const result = {
            emotion: String(parsed.emotion ?? "neutral").toLowerCase(),
            confidence: Number(parsed.confidence ?? 0),
            details: String(parsed.details ?? ""),
        };
        await EmotionHistoryModel.create({
            userId: input.userId,
            userEmail: input.userEmail,
            ...result,
            date: new Date(),
        });
        return result;
    }
    catch {
        await EmotionHistoryModel.create({
            userId: input.userId,
            userEmail: input.userEmail,
            ...fallback,
            date: new Date(),
        });
        return fallback;
    }
}
