import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { cacheStore } from "./db/cache.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/mongoose.js";
import { logger, summarizeHeaders, summarizeValue } from "./lib/logger.js";
import { initializeFirebase } from "./plugins/auth.js";
import { avatarRoutes } from "./routes/avatar.js";
import { chatRoutes } from "./routes/chat.js";
import { documentRoutes } from "./routes/documents.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";
import { journalRoutes } from "./routes/journals.js";
import { taskRoutes } from "./routes/tasks.js";
import { userRoutes } from "./routes/users.js";
import { ensureStorageDirectories } from "./services/document-storage.js";

declare module "fastify" {
  interface FastifyRequest {
    responseSummary?: unknown;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart);

  initializeFirebase();
  await ensureStorageDirectories();
  await connectToDatabase();
  await cacheStore.connect();

  app.addHook("onRequest", async (request) => {
    logger.info("Incoming request", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      route: request.routeOptions.url,
      ip: request.ip,
      headers: summarizeHeaders(request.headers as Record<string, unknown>),
      authHint: {
        userId: String(request.headers["x-user-id"] ?? "").trim() || undefined,
        hasAuthorization: Boolean(request.headers.authorization),
      },
    });
  });

  app.addHook("preHandler", async (request) => {
    logger.info("Request body received", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      contentType: request.headers["content-type"] ?? "",
      body: summarizeValue(request.body),
      query: summarizeValue(request.query),
      params: summarizeValue(request.params),
      resolvedAuth: request.auth
        ? {
            uid: request.auth.uid,
            email: request.auth.email,
          }
        : undefined,
    });
  });

  app.addHook("onSend", async (request, reply, payload) => {
    request.responseSummary = payload instanceof Buffer ? `[buffer:${payload.length}]` : summarizeValue(payload);
    logger.info("Outgoing response", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      response: request.responseSummary,
    });

    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info("Request completed", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  await app.register(healthRoutes);
  await app.register(journalRoutes);
  await app.register(taskRoutes);
  await app.register(eventRoutes);
  await app.register(documentRoutes);
  await app.register(chatRoutes);
  await app.register(avatarRoutes);
  await app.register(userRoutes);

  app.addHook("onClose", async () => {
    await cacheStore.disconnect();
    await disconnectFromDatabase();
  });

  app.setErrorHandler((error, _request, reply) => {
    logger.error("Unhandled request error", {
      requestId: _request.id,
      method: _request.method,
      url: _request.url,
      statusCode: reply.statusCode,
      error,
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    const statusCode = message === "Invalid document id format." || message === "Invalid file path" ? 400 : 500;
    void reply.code(statusCode).send({
      error: message,
    });
  });

  return app;
}
