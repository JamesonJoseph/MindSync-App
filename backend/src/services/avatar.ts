import { loadPrompt } from "../lib/prompts.js";
import { utcNow } from "../lib/time.js";
import { logger } from "../lib/logger.js";
import { AvatarConversationModel } from "../models/avatar-conversation.js";
import { VoiceAnalysisModel } from "../models/voice-analysis.js";
import { groqService } from "./groq.js";
import { getUserContext } from "./user-context.js";
import type { ChatMessage } from "./conversation.js";

function normalizeLanguageCode(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized && normalized.toLowerCase() !== "unknown" ? normalized : undefined;
}

function buildAvatarHistoryMessages(
  history: Array<{ user_query?: unknown; assistant_response?: unknown }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return history
    .slice(-6)
    .flatMap((entry) => {
      const userQuery = String(entry.user_query ?? "").trim();
      const assistantResponse = String(entry.assistant_response ?? "").trim();
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

      if (userQuery) {
        messages.push({ role: "user", content: userQuery });
      }
      if (assistantResponse) {
        messages.push({ role: "assistant", content: assistantResponse });
      }

      return messages;
    });
}

function normalizeReplyForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeReply(value: string): string[] {
  return normalizeReplyForComparison(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function calculateTokenOverlap(a: string, b: string): number {
  const left = new Set(tokenizeReply(a));
  const right = new Set(tokenizeReply(b));
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const sharedCount = [...left].filter((token) => right.has(token)).length;
  return sharedCount / Math.min(left.size, right.size);
}

function isTooSimilarToRecentReplies(candidate: string, recentReplies: string[]): boolean {
  const normalizedCandidate = normalizeReplyForComparison(candidate);
  if (!normalizedCandidate) {
    return false;
  }

  return recentReplies.some((reply) => {
    const normalizedReply = normalizeReplyForComparison(reply);
    if (!normalizedReply) {
      return false;
    }

    if (normalizedReply === normalizedCandidate) {
      return true;
    }

    if (
      normalizedReply.length > 40 &&
      normalizedCandidate.length > 40 &&
      (normalizedReply.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedReply))
    ) {
      return true;
    }

    return calculateTokenOverlap(candidate, reply) >= 0.85;
  });
}

function buildRecentRepliesText(recentReplies: string[]): string {
  return recentReplies.length > 0 ? recentReplies.map((reply) => `- ${reply}`).join("\n") : "None";
}

async function generateAvatarReply(input: {
  uid: string;
  email: string;
  latestUserMessage: string;
  languageCode?: string;
  history: Array<{ user_query?: unknown; assistant_response?: unknown }>;
  basePromptName: "avatar-chat.md" | "voice-analysis.md";
  maxCompletionTokens: number;
  temperature: number;
  responseFormat: "text" | "json";
}): Promise<string> {
  const normalizedLanguageCode = normalizeLanguageCode(input.languageCode);
  const userContext = await getUserContext(input.uid);
  const contextMessages = buildAvatarHistoryMessages(input.history);
  const recentReplies = input.history
    .map((entry) => String(entry.assistant_response ?? "").trim())
    .filter(Boolean)
    .slice(-4);

  const baseSystemPrompt = [
    loadPrompt(input.basePromptName),
    `Current user language hint: ${normalizedLanguageCode ?? "unknown"}.`,
    "Do not repeat or closely paraphrase any recent assistant reply.",
    "Use the user's context and the newest message to respond with fresh wording.",
    input.responseFormat === "json" ? "Return only valid JSON." : "Return only the spoken reply text.",
    `Recent assistant replies to avoid:\n${buildRecentRepliesText(recentReplies)}`,
  ].join("\n\n");

  const sharedMessages: ChatMessage[] = [
    ...contextMessages,
    {
      role: "user",
      content: `User profile:\n${JSON.stringify(userContext, null, 2)}\n\nLatest message language hint: ${normalizedLanguageCode ?? "unknown"}\n\nLatest user message:\n${input.latestUserMessage}`,
    },
  ];

  const attempts = [
    {
      systemPrompt: baseSystemPrompt,
      retryLabel: "initial",
    },
    {
      systemPrompt: `${baseSystemPrompt}\n\nYour previous draft was too similar to recent replies. Rewrite it with materially different wording, a different acknowledgement, and a different closing question while keeping the same intent.`,
      retryLabel: "retry",
    },
  ];

  for (const attempt of attempts) {
    const candidate = await groqService.generateText({
      systemPrompt: attempt.systemPrompt,
      messages: sharedMessages,
      maxCompletionTokens: input.maxCompletionTokens,
      temperature: input.temperature,
      bypassCache: true,
      logContext: {
        feature: "avatar",
        uid: input.uid,
        responseFormat: input.responseFormat,
        retryLabel: attempt.retryLabel,
      },
    });

    if (!isTooSimilarToRecentReplies(candidate, recentReplies)) {
      if (attempt.retryLabel !== "initial") {
        logger.info("Avatar response regenerated to avoid repetition", {
          uid: input.uid,
          responseFormat: input.responseFormat,
        });
      }
      return candidate;
    }

    logger.warn("Avatar response too similar to recent replies", {
      uid: input.uid,
      responseFormat: input.responseFormat,
      retryLabel: attempt.retryLabel,
    });
  }

  return groqService.generateText({
    systemPrompt: `${baseSystemPrompt}\n\nThis is the final attempt. Keep the response concise and fresh.`,
    messages: sharedMessages,
    maxCompletionTokens: input.maxCompletionTokens,
    temperature: Math.max(0.55, input.temperature - 0.1),
    bypassCache: true,
    logContext: {
      feature: "avatar",
      uid: input.uid,
      responseFormat: input.responseFormat,
      retryLabel: "final",
    },
  });
}

export async function runAvatarChat(input: {
  uid: string;
  email: string;
  message: string;
  languageHint?: string;
}): Promise<{ role: "assistant"; content: string }> {
  const history = await AvatarConversationModel.find({ userId: input.uid }).sort({ date: -1 }).limit(20).lean();
  history.reverse();

  const content = await generateAvatarReply({
    uid: input.uid,
    email: input.email,
    latestUserMessage: input.message,
    languageCode: input.languageHint,
    history,
    basePromptName: "avatar-chat.md",
    maxCompletionTokens: 180,
    temperature: 0.9,
    responseFormat: "text",
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

export async function analyzeVoiceTranscript(input: {
  uid: string;
  email: string;
  transcript: string;
  languageCode?: string;
}): Promise<Record<string, unknown>> {
  const normalizedLanguageCode = normalizeLanguageCode(input.languageCode);

  if (!input.transcript.trim()) {
    return {
      transcript: "",
      emotion: "neutral",
      confidence: 0,
      suggestions: "I couldn't hear what you said. Could you try again?",
      earlyWarning: "",
      languageCode: normalizedLanguageCode ?? "unknown",
    };
  }

  const history = await AvatarConversationModel.find({ userId: input.uid }).sort({ date: -1 }).limit(20).lean();
  history.reverse();

  const resultText = await generateAvatarReply({
    uid: input.uid,
    email: input.email,
    latestUserMessage: input.transcript,
    languageCode: normalizedLanguageCode,
    history,
    basePromptName: "voice-analysis.md",
    maxCompletionTokens: 220,
    temperature: 0.82,
    responseFormat: "json",
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(resultText) as Record<string, unknown>;
  } catch {
    parsed = {
      emotion: "neutral",
      confidence: 50,
      suggestions: resultText || "Thank you for sharing. I'm here to help.",
      earlyWarning: "",
    };
  }

  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.join(". ") : String(parsed.suggestions ?? "");

  logger.info("Avatar voice analysis complete", {
    uid: input.uid,
    languageCode: normalizedLanguageCode ?? "unknown",
    emotion: String(parsed.emotion ?? "neutral"),
    confidence: Number(parsed.confidence ?? 0),
  });

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
    languageCode: normalizedLanguageCode ?? "unknown",
    date: utcNow(),
  });

  return {
    transcript: input.transcript,
    emotion: String(parsed.emotion ?? "neutral"),
    confidence: Number(parsed.confidence ?? 0),
    suggestions,
    earlyWarning: String(parsed.earlyWarning ?? ""),
    languageCode: normalizedLanguageCode ?? "unknown",
  };
}

export async function analyzeEarlyWarning(userId: string): Promise<Record<string, unknown>> {
  const userContext = await getUserContext(userId);
  const resultText = await groqService.generateText({
    systemPrompt: loadPrompt("early-warning.md"),
    messages: [{ role: "user", content: JSON.stringify(userContext, null, 2) }],
    maxCompletionTokens: 180,
    temperature: 0.2,
  });

  try {
    return JSON.parse(resultText) as Record<string, unknown>;
  } catch {
    return {
      level: "green",
      message: "You're doing well overall. Keep checking in with yourself regularly.",
      recommendation: "Continue your current routine and reach out early if things start to feel heavier.",
    };
  }
}
