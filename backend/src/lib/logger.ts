type LogLevel = "info" | "warn" | "error";

const REDACTED_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);
const LARGE_FIELD_NAMES = new Set([
  "audio",
  "file",
  "image",
  "imageBase64",
  "audioBase64",
  "content",
  "transcript",
  "suggestions",
  "assistant_response",
  "user_query",
  "text",
]);

function truncate(value: string, maxLength = 240): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: error };
}

function summarizeString(value: string, key?: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (key && LARGE_FIELD_NAMES.has(key)) {
    return `[len=${trimmed.length}] ${truncate(trimmed, 120)}`;
  }

  return truncate(trimmed);
}

function summarizeArray(values: unknown[], depth: number): unknown[] {
  return values.slice(0, 10).map((value) => summarizeValue(value, undefined, depth + 1));
}

function summarizeObject(
  value: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  if (depth >= 3) {
    return { summary: "[object]" };
  }

  const entries = Object.entries(value).slice(0, 20);
  return Object.fromEntries(
    entries.map(([key, nestedValue]) => [key, summarizeValue(nestedValue, key, depth + 1)]),
  );
}

export function summarizeValue(value: unknown, key?: string, depth = 0): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return summarizeString(value, key);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return normalizeError(value);
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer:${value.length}]`;
  }

  if (Array.isArray(value)) {
    return summarizeArray(value, depth);
  }

  if (typeof value === "object") {
    return summarizeObject(value as Record<string, unknown>, depth);
  }

  return String(value);
}

export function summarizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (REDACTED_HEADERS.has(key.toLowerCase())) {
        return [key, "[redacted]"];
      }

      return [key, summarizeValue(value, key)];
    }),
  );
}

function emit(level: LogLevel, message: string, meta?: unknown) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta === undefined ? {} : { meta: summarizeValue(meta) }),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, meta?: unknown) {
    emit("info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    emit("warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    emit("error", message, meta);
  },
};
