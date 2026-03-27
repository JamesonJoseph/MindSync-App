import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
export async function connectToDatabase() {
    await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        serverSelectionTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
    });
    logger.info("Connected to MongoDB");
}
export async function disconnectFromDatabase() {
    await mongoose.disconnect();
}
