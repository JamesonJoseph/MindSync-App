import fs from "node:fs";
import admin from "firebase-admin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import type { AuthContext } from "../types/auth.js";

let firebaseEnabled = false;

export function initializeFirebase(): void {
  if (admin.apps.length > 0) {
    firebaseEnabled = true;
    return;
  }

  try {
    const options: admin.AppOptions = {};
    if (env.FIREBASE_PROJECT_ID) {
      options.projectId = env.FIREBASE_PROJECT_ID;
    }

    if (env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
      options.credential = admin.credential.cert(env.GOOGLE_APPLICATION_CREDENTIALS);
    }

    admin.initializeApp(options);
    firebaseEnabled = true;
  } catch {
    firebaseEnabled = false;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

function getFallbackAuth(request: FastifyRequest): AuthContext | null {
  if (!env.ALLOW_HEADER_AUTH_FALLBACK) {
    return null;
  }

  const uid = String(request.headers["x-user-id"] ?? "").trim();
  const email = String(request.headers["x-user-email"] ?? "").trim();
  return uid ? { uid, email } : null;
}

export async function resolveAuth(request: FastifyRequest): Promise<AuthContext | null> {
  const fallback = getFallbackAuth(request);

  if (!firebaseEnabled) {
    return fallback;
  }

  const authHeader = String(request.headers.authorization ?? "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return fallback;
  }

  const token = authHeader.slice("bearer ".length);

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: String(decoded.uid ?? ""),
      email: String(decoded.email ?? ""),
    };
  } catch {
    return fallback;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = await resolveAuth(request);

  if (auth) {
    request.auth = auth;
    return;
  }

  if (!firebaseEnabled) {
    void reply.code(500).send({
      error: "Firebase admin not configured on server. Set GOOGLE_APPLICATION_CREDENTIALS or provide header fallback.",
    });
    return;
  }

  const authHeader = String(request.headers.authorization ?? "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    void reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  void reply.code(401).send({ error: "Invalid or expired token" });
}
