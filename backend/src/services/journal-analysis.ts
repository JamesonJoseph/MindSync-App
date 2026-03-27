import { env } from "../config/env.js";
import { cacheStore } from "../db/cache.js";
import { loadPrompt } from "../lib/prompts.js";
import { normalizeForCache } from "../lib/strings.js";
import { groqService } from "./groq.js";

const FAST_ANALYSIS_CHAR_LIMIT = 140;

export function buildLocalJournalAnalysis(content: string): string {
  const text = content.trim();
  if (!text) {
    return "I need a little more detail in your journal entry before I can analyze it.";
  }

  const lowered = text.toLowerCase();
  const emotionKeywords = {
    stress: ["stressed", "stress", "overwhelmed", "pressure", "burnout", "anxious", "anxiety", "panic"],
    sadness: ["sad", "down", "upset", "hurt", "lonely", "empty", "cry", "depressed"],
    anger: ["angry", "mad", "annoyed", "frustrated", "irritated"],
    joy: ["happy", "grateful", "excited", "proud", "relieved", "calm", "peaceful"],
  };

  const detected = Object.entries(emotionKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => lowered.includes(keyword)))
    .map(([label]) => label);

  const tone =
    detected.length === 0
      ? "Your entry suggests you may be processing a mix of emotions."
      : detected.length === 1 && detected[0] === "joy"
        ? "Your entry sounds mostly positive and grounded."
        : `Your entry suggests ${detected.join(", ")} may be affecting you right now.`;

  const detailHint =
    text.split(/\s+/).length >= 25
      ? "You described enough detail to spot a pattern, so it may help to notice which situation or person triggered the strongest reaction."
      : "Adding a little more detail about what happened and how your body felt could make the pattern clearer.";

  return `${tone} ${detailHint} A useful next step is to name the main trigger, what you needed in that moment, and one small action you can take today.`;
}

export async function analyzeJournal(content: string): Promise<{ analysis: string; cached?: boolean; fallback?: boolean }> {
  const normalized = normalizeForCache(content);
  const fallback = buildLocalJournalAnalysis(content);

  if (!normalized) {
    return { analysis: fallback };
  }

  const cacheKey = cacheStore.buildKey("journal-analysis", {
    content: normalized,
    prompt: "journal-analysis.md",
    model: env.GROQ_MODEL,
  });

  const cached = await cacheStore.get(cacheKey);
  if (cached) {
    return { analysis: cached, cached: true };
  }

  if (normalized.length <= FAST_ANALYSIS_CHAR_LIMIT) {
    await cacheStore.set(cacheKey, fallback, env.CACHE_TTL_ANALYZE_SECONDS);
    return { analysis: fallback, fallback: true };
  }

  try {
    const prompt = loadPrompt("journal-analysis.md");
    const analysis = await groqService.generateText({
      systemPrompt: prompt,
      messages: [{ role: "user", content }],
    });

    const finalAnalysis = analysis.trim() || fallback;
    await cacheStore.set(cacheKey, finalAnalysis, env.CACHE_TTL_ANALYZE_SECONDS);
    return { analysis: finalAnalysis };
  } catch {
    await cacheStore.set(cacheKey, fallback, env.CACHE_TTL_ANALYZE_SECONDS);
    return { analysis: fallback, fallback: true };
  }
}
