import crypto from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

export class CacheStore {
  private redis?: RedisClientType;
  private memory = new Map<string, MemoryEntry>();

  async connect(): Promise<void> {
    if (!env.REDIS_URL) {
      logger.warn("REDIS_URL not set, using in-memory cache fallback");
      return;
    }

    try {
      this.redis = createClient({ url: env.REDIS_URL });
      this.redis.on("error", (error) => logger.warn("Redis client error", error));
      await this.redis.connect();
      logger.info("Connected to Redis");
    } catch (error) {
      this.redis = undefined;
      logger.warn("Redis unavailable, using in-memory cache fallback", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.redis?.isOpen) {
      return this.redis.get(key);
    }

    const memoryEntry = this.memory.get(key);
    if (!memoryEntry) {
      return null;
    }

    if (memoryEntry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return memoryEntry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.set(key, value, { EX: ttlSeconds });
      return;
    }

    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  buildKey(namespace: string, payload: unknown): string {
    const digest = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return `${namespace}:${digest}`;
  }
}

export const cacheStore = new CacheStore();
