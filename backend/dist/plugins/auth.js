import fs from "node:fs";
import admin from "firebase-admin";
import { env } from "../config/env.js";
let firebaseEnabled = false;
export function initializeFirebase() {
    if (admin.apps.length > 0) {
        firebaseEnabled = true;
        return;
    }
    try {
        const options = {};
        if (env.FIREBASE_PROJECT_ID) {
            options.projectId = env.FIREBASE_PROJECT_ID;
        }
        if (env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
            options.credential = admin.credential.cert(env.GOOGLE_APPLICATION_CREDENTIALS);
        }
        admin.initializeApp(options);
        firebaseEnabled = true;
    }
    catch {
        firebaseEnabled = false;
    }
}
function getFallbackAuth(request) {
    if (!env.ALLOW_HEADER_AUTH_FALLBACK) {
        return null;
    }
    const uid = String(request.headers["x-user-id"] ?? "").trim();
    const email = String(request.headers["x-user-email"] ?? "").trim();
    return uid ? { uid, email } : null;
}
export async function requireAuth(request, reply) {
    const fallback = getFallbackAuth(request);
    if (!firebaseEnabled) {
        if (fallback) {
            request.auth = fallback;
            return;
        }
        void reply.code(500).send({
            error: "Firebase admin not configured on server. Set GOOGLE_APPLICATION_CREDENTIALS or provide header fallback.",
        });
        return;
    }
    const authHeader = String(request.headers.authorization ?? "");
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        if (fallback) {
            request.auth = fallback;
            return;
        }
        void reply.code(401).send({ error: "Missing or invalid Authorization header" });
        return;
    }
    const token = authHeader.slice("bearer ".length);
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        request.auth = {
            uid: String(decoded.uid ?? ""),
            email: String(decoded.email ?? ""),
        };
    }
    catch {
        if (fallback) {
            request.auth = fallback;
            return;
        }
        void reply.code(401).send({ error: "Invalid or expired token" });
    }
}
