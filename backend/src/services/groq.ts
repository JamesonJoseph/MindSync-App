import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { cacheStore } from "../db/cache.js";
import { logger } from "../lib/logger.js";
import type { ChatMessage } from "./conversation.js";

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

class GroqService {
  private readonly client = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

  private ensureClient(): Groq {
    if (!this.client) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    return this.client;
  }

  async generateText(input: {
    systemPrompt?: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    maxCompletionTokens?: number;
    temperature?: number;
    bypassCache?: boolean;
    logContext?: Record<string, unknown>;
  }): Promise<string> {
    const client = this.ensureClient();
    const messages = input.systemPrompt
      ? [{ role: "system", content: input.systemPrompt }, ...input.messages]
      : [...input.messages];

    const cacheKey = cacheStore.buildKey("groq-text", {
      model: env.GROQ_MODEL,
      messages,
      tools: input.tools?.map((tool) => tool.function.name) ?? [],
    });

    if (!input.bypassCache) {
      const cached = await cacheStore.get(cacheKey);
      if (cached) {
        logger.info("Groq cache hit", {
          model: env.GROQ_MODEL,
          context: input.logContext,
        });
        return cached;
      }
    }

    logger.info("Groq request", {
      model: env.GROQ_MODEL,
      messageCount: messages.length,
      toolNames: input.tools?.map((tool) => tool.function.name) ?? [],
      bypassCache: Boolean(input.bypassCache),
      context: input.logContext,
    });

    const response = await client.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: messages as any,
      tools: input.tools as any,
      tool_choice: input.tools ? "auto" : undefined,
      stream: false,
      max_completion_tokens: input.maxCompletionTokens ?? 220,
      temperature: input.temperature ?? 0.35,
    });

    const content = String(response.choices?.[0]?.message?.content ?? "");
    logger.info("Groq response", {
      model: env.GROQ_MODEL,
      contentLength: content.length,
      context: input.logContext,
    });

    if (!input.bypassCache) {
      await cacheStore.set(cacheKey, content, env.CACHE_TTL_CHAT_SECONDS);
    }

    return content;
  }

  async createToolCallingResponse(input: {
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): Promise<any> {
    const client = this.ensureClient();
    return client.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [{ role: "system", content: input.systemPrompt }, ...input.messages] as any,
      tools: input.tools as any,
      tool_choice: "auto",
      stream: false,
      max_completion_tokens: 240,
      temperature: 0.2,
    });
  }
}

export const groqService = new GroqService();

logger.info(`Groq text client initialized with model ${env.GROQ_MODEL}`);
