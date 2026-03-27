import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({ host: "0.0.0.0", port: env.PORT });
  logger.info(`Server listening on port ${env.PORT}`);
} catch (error) {
  logger.error("Failed to start server", error);
  process.exit(1);
}
