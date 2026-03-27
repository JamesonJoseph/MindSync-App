import { parseObjectId } from "../lib/ids.js";
import { serializeDocument, serializeDocuments } from "../lib/serialization.js";
import { JournalModel } from "../models/journal.js";
import { requireAuth } from "../plugins/auth.js";
import { analyzeJournal } from "../services/journal-analysis.js";
export const journalRoutes = async (app) => {
    app.get("/api/journals", { preHandler: requireAuth }, async (request) => {
        const docs = await JournalModel.find({ userId: request.auth.uid }).sort({ date: -1 }).lean();
        return serializeDocuments(docs);
    });
    app.get("/api/journals/search", { preHandler: requireAuth }, async (request, reply) => {
        const { startDate, endDate, q, limit = "500", sort = "desc" } = request.query;
        const mongoQuery = { userId: request.auth.uid };
        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                dateFilter.$gte = new Date(startDate);
            }
            if (endDate) {
                const date = new Date(endDate);
                date.setUTCHours(23, 59, 59, 999);
                dateFilter.$lte = date;
            }
            mongoQuery.date = dateFilter;
        }
        if (q?.trim()) {
            mongoQuery.$or = [
                { title: { $regex: q, $options: "i" } },
                { content: { $regex: q, $options: "i" } },
                { aiAnalysis: { $regex: q, $options: "i" } },
            ];
        }
        const docs = await JournalModel.find(mongoQuery)
            .sort({ date: sort === "asc" ? 1 : -1 })
            .limit(Math.min(Number(limit) || 500, 5000))
            .lean();
        return serializeDocuments(docs);
    });
    app.post("/api/journals", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const doc = await JournalModel.create({
            userId: request.auth.uid,
            userEmail: request.auth.email,
            title: String(payload.title ?? "Untitled Entry"),
            content: String(payload.content ?? ""),
            date: new Date(),
            sentimentScore: Number(payload.sentimentScore ?? 0),
            aiAnalysis: String(payload.aiAnalysis ?? ""),
        });
        return reply.code(201).send(serializeDocument(doc.toObject()));
    });
    app.put("/api/journals/:journalId", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const allowedFields = new Set(["title", "content", "date", "sentimentScore", "aiAnalysis"]);
        const updates = Object.fromEntries(Object.entries(payload).filter(([key]) => allowedFields.has(key)));
        if (Object.keys(updates).length === 0) {
            return reply.code(400).send({ error: "No valid fields to update" });
        }
        const result = await JournalModel.findOneAndUpdate({ _id: parseObjectId(String(request.params.journalId)), userId: request.auth.uid }, { $set: updates }, { new: true }).lean();
        if (!result) {
            return reply.code(404).send({ error: "Journal not found" });
        }
        return serializeDocument(result);
    });
    app.delete("/api/journals/:journalId", { preHandler: requireAuth }, async (request, reply) => {
        const deleted = await JournalModel.deleteOne({
            _id: parseObjectId(String(request.params.journalId)),
            userId: request.auth.uid,
        });
        if (deleted.deletedCount === 0) {
            return reply.code(404).send({ error: "Journal not found" });
        }
        return { message: "Journal deleted successfully" };
    });
    app.post("/api/analyze", async (request) => {
        const payload = request.body;
        return analyzeJournal(String(payload.content ?? ""));
    });
};
