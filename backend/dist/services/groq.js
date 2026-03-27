import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { cacheStore } from "../db/cache.js";
import { logger } from "../lib/logger.js";
class GroqService {
    client = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;
    ensureClient() {
        if (!this.client) {
            throw new Error("GROQ_API_KEY is not configured");
        }
        return this.client;
    }
    async generateText(input) {
        const client = this.ensureClient();
        const messages = input.systemPrompt
            ? [{ role: "system", content: input.systemPrompt }, ...input.messages]
            : [...input.messages];
        const cacheKey = cacheStore.buildKey("groq-text", {
            model: env.GROQ_MODEL,
            messages,
            tools: input.tools?.map((tool) => tool.function.name) ?? [],
        });
        const cached = await cacheStore.get(cacheKey);
        if (cached) {
            return cached;
        }
        const response = await client.chat.completions.create({
            model: env.GROQ_MODEL,
            messages: messages,
            tools: input.tools,
            tool_choice: input.tools ? "auto" : undefined,
            stream: false,
            max_completion_tokens: input.maxCompletionTokens ?? 220,
            temperature: input.temperature ?? 0.35,
        });
        const content = String(response.choices?.[0]?.message?.content ?? "");
        await cacheStore.set(cacheKey, content, env.CACHE_TTL_CHAT_SECONDS);
        return content;
    }
    async createToolCallingResponse(input) {
        const client = this.ensureClient();
        return client.chat.completions.create({
            model: env.GROQ_MODEL,
            messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
            tools: input.tools,
            tool_choice: "auto",
            stream: false,
            max_completion_tokens: 240,
            temperature: 0.2,
        });
    }
}
export const groqService = new GroqService();
logger.info(`Groq text client initialized with model ${env.GROQ_MODEL}`);
