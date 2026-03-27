import fs from "node:fs/promises";
import { parseObjectId } from "../lib/ids.js";
import { serializeDocument, serializeDocuments } from "../lib/serialization.js";
import { DocumentModel } from "../models/document.js";
import { requireAuth } from "../plugins/auth.js";
import { deleteStoredFile, resolveUserUploadPath, storeUserPdf } from "../services/document-storage.js";
export const documentRoutes = async (app) => {
    app.get("/api/documents", { preHandler: requireAuth }, async (request) => {
        const docs = await DocumentModel.find({ userId: request.auth.uid }).sort({ date: -1 }).lean();
        return serializeDocuments(docs);
    });
    app.post("/api/documents", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const doc = await DocumentModel.create({
            userId: request.auth.uid,
            userEmail: request.auth.email,
            title: String(payload.title ?? "Untitled Document"),
            content: String(payload.content ?? ""),
            type: String(payload.type ?? "note"),
            date: new Date(),
        });
        return reply.code(201).send(serializeDocument(doc.toObject()));
    });
    app.post("/api/documents/upload-pdf", { preHandler: requireAuth }, async (request, reply) => {
        const file = await request.file();
        if (!file) {
            return reply.code(400).send({ error: "File is required" });
        }
        const buffer = await file.toBuffer();
        const originalName = file.filename || "document.pdf";
        const mimeType = file.mimetype || "application/pdf";
        if (mimeType !== "application/pdf" && !originalName.toLowerCase().endsWith(".pdf")) {
            return reply.code(400).send({ error: "Only PDF files are supported" });
        }
        if (buffer.byteLength === 0) {
            return reply.code(400).send({ error: "Uploaded PDF is empty" });
        }
        if (buffer.byteLength > 10 * 1024 * 1024) {
            return reply.code(400).send({ error: "PDF must be 10 MB or smaller" });
        }
        const stored = await storeUserPdf(request.auth.uid, originalName, buffer);
        return {
            storagePath: stored.storagePath,
            fileName: stored.fileName,
            mimeType: "application/pdf",
            fileSize: stored.fileSize,
            downloadUrl: `/api/documents/file?path=${encodeURIComponent(stored.storagePath)}`,
        };
    });
    app.get("/api/documents/file", { preHandler: requireAuth }, async (request, reply) => {
        const { path } = request.query;
        if (!path) {
            return reply.code(400).send({ error: "path is required" });
        }
        const filePath = resolveUserUploadPath(request.auth.uid, path);
        const fileBuffer = await fs.readFile(filePath);
        reply.header("Content-Type", "application/pdf");
        return reply.send(fileBuffer);
    });
    app.delete("/api/documents/file", { preHandler: requireAuth }, async (request, reply) => {
        const { path } = request.query;
        if (!path) {
            return reply.code(400).send({ error: "path is required" });
        }
        const filePath = resolveUserUploadPath(request.auth.uid, path);
        await deleteStoredFile(filePath);
        return { message: "File deleted successfully" };
    });
    app.put("/api/documents/:documentId", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const updated = await DocumentModel.findOneAndUpdate({ _id: parseObjectId(String(request.params.documentId)), userId: request.auth.uid }, {
            $set: {
                title: String(payload.title ?? ""),
                content: String(payload.content ?? ""),
                type: String(payload.type ?? "secure-doc"),
            },
        }, { new: true }).lean();
        if (!updated) {
            return reply.code(404).send({ error: "Document not found" });
        }
        return serializeDocument(updated);
    });
    app.delete("/api/documents/:documentId", { preHandler: requireAuth }, async (request, reply) => {
        const deleted = await DocumentModel.deleteOne({
            _id: parseObjectId(String(request.params.documentId)),
            userId: request.auth.uid,
        });
        if (deleted.deletedCount === 0) {
            return reply.code(404).send({ error: "Document not found" });
        }
        return { message: "Document deleted successfully" };
    });
};
