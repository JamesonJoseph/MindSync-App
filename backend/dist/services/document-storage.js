import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appPaths } from "../config/env.js";
export async function ensureStorageDirectories() {
    await fs.mkdir(appPaths.uploadsDir, { recursive: true });
    await fs.mkdir(appPaths.tempDir, { recursive: true });
}
export function sanitizePdfName(name) {
    const baseName = path.basename(name || "document.pdf");
    const safeName = baseName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[_./-]+|[_./-]+$/g, "");
    const normalized = safeName || "document.pdf";
    return normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;
}
export async function storeUserPdf(uid, fileName, content) {
    const userDir = path.join(appPaths.uploadsDir, uid);
    await fs.mkdir(userDir, { recursive: true });
    const originalName = sanitizePdfName(fileName);
    const storedFileName = `${randomUUID().replaceAll("-", "")}_${originalName}`;
    await fs.writeFile(path.join(userDir, storedFileName), content);
    return {
        storagePath: `${uid}/${storedFileName}`,
        fileName: originalName,
        fileSize: content.byteLength,
    };
}
export function resolveUserUploadPath(uid, storagePath) {
    const normalized = storagePath.replaceAll("\\", "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0] !== uid || parts.some((part) => part === "..")) {
        throw new Error("Invalid file path");
    }
    const resolved = path.resolve(appPaths.uploadsDir, ...parts);
    const uploadsRoot = path.resolve(appPaths.uploadsDir);
    if (!resolved.startsWith(uploadsRoot)) {
        throw new Error("Invalid file path");
    }
    return resolved;
}
export async function deleteStoredFile(filePath) {
    await fs.rm(filePath, { force: true });
}
