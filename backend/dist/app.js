import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { cacheStore } from "./db/cache.js";
import { connectToDatabase, disconnectFromDatabase } from "./db/mongoose.js";
import { logger } from "./lib/logger.js";
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
        logger.error("Unhandled request error", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        const statusCode = message === "Invalid document id format." || message === "Invalid file path" ? 400 : 500;
        void reply.code(statusCode).send({
            error: message,
        });
    });
    return app;
}
