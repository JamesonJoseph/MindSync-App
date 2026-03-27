import { loadPrompt } from "../lib/prompts.js";
import { utcNow } from "../lib/time.js";
import { AvatarConversationModel } from "../models/avatar-conversation.js";
import { VoiceAnalysisModel } from "../models/voice-analysis.js";
import { groqService } from "./groq.js";
import { getUserContext } from "./user-context.js";
export async function runAvatarChat(input) {
    const history = await AvatarConversationModel.find({ userId: input.uid }).sort({ date: -1 }).limit(20).lean();
    history.reverse();
    const messages = history.flatMap((entry) => [
        { role: "user", content: String(entry.user_query ?? "") },
        { role: "assistant", content: String(entry.assistant_response ?? "") },
    ]);
    messages.push({ role: "user", content: input.message });
    const content = await groqService.generateText({
        systemPrompt: `${loadPrompt("avatar-chat.md")}\n\nCurrent user language hint: ${input.languageHint ?? "unknown"}`,
        messages,
        maxCompletionTokens: 180,
        temperature: 0.72,
    });
    await AvatarConversationModel.create({
        userId: input.uid,
        userEmail: input.email,
        user_query: input.message,
        assistant_response: content,
        date: utcNow(),
    });
    return { role: "assistant", content };
}
export async function analyzeVoiceTranscript(input) {
    if (!input.transcript.trim()) {
        return {
            transcript: "",
            emotion: "neutral",
            confidence: 0,
            suggestions: "I couldn't hear what you said. Could you try again?",
            earlyWarning: "",
            languageCode: input.languageCode ?? "unknown",
        };
    }
    const userContext = await getUserContext(input.uid);
    const history = await AvatarConversationModel.find({ userId: input.uid }).sort({ date: -1 }).limit(20).lean();
    history.reverse();
    const contextMessages = history.flatMap((entry) => [
        { role: "user", content: String(entry.user_query ?? "") },
        { role: "assistant", content: String(entry.assistant_response ?? "") },
    ]);
    const resultText = await groqService.generateText({
        systemPrompt: `${loadPrompt("voice-analysis.md")}\n\nThe reply must stay in the same language and script as the transcript. Language hint: ${input.languageCode ?? "unknown"}.`,
        messages: [
            ...contextMessages,
            {
                role: "user",
                content: `User profile:\n${JSON.stringify(userContext, null, 2)}\n\nTranscript language hint: ${input.languageCode ?? "unknown"}\n\nTranscript:\n${input.transcript}`,
            },
        ],
        maxCompletionTokens: 220,
        temperature: 0.55,
    });
    let parsed;
    try {
        parsed = JSON.parse(resultText);
    }
    catch {
        parsed = {
            emotion: "neutral",
            confidence: 50,
            suggestions: resultText || "Thank you for sharing. I'm here to help.",
            earlyWarning: "",
        };
    }
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.join(". ") : String(parsed.suggestions ?? "");
    await AvatarConversationModel.create({
        userId: input.uid,
        userEmail: input.email,
        user_query: input.transcript,
        assistant_response: suggestions,
        date: utcNow(),
    });
    await VoiceAnalysisModel.create({
        userId: input.uid,
        userEmail: input.email,
        transcript: input.transcript,
        emotion: String(parsed.emotion ?? "neutral"),
        confidence: Number(parsed.confidence ?? 0),
        suggestions,
        earlyWarning: String(parsed.earlyWarning ?? ""),
        languageCode: input.languageCode ?? "unknown",
        date: utcNow(),
    });
    return {
        transcript: input.transcript,
        emotion: String(parsed.emotion ?? "neutral"),
        confidence: Number(parsed.confidence ?? 0),
        suggestions,
        earlyWarning: String(parsed.earlyWarning ?? ""),
        languageCode: input.languageCode ?? "unknown",
    };
}
export async function analyzeEarlyWarning(userId) {
    const userContext = await getUserContext(userId);
    const resultText = await groqService.generateText({
        systemPrompt: loadPrompt("early-warning.md"),
        messages: [{ role: "user", content: JSON.stringify(userContext, null, 2) }],
        maxCompletionTokens: 180,
        temperature: 0.2,
    });
    try {
        return JSON.parse(resultText);
    }
    catch {
        return {
            level: "green",
            message: "You're doing well overall. Keep checking in with yourself regularly.",
            recommendation: "Continue your current routine and reach out early if things start to feel heavier.",
        };
    }
}
