import { parseObjectId } from "../lib/ids.js";
import { serializeDocument, serializeDocuments } from "../lib/serialization.js";
import { requireAuth } from "../plugins/auth.js";
import { BirthdayModel } from "../models/birthday.js";
import { EventModel } from "../models/event.js";
function deriveMonthDay(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value.length >= 10 ? value.slice(5, 10) : "";
    }
    return `${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}
export const eventRoutes = async (app) => {
    app.get("/api/birthdays", { preHandler: requireAuth }, async (request) => {
        const docs = await BirthdayModel.find({ userId: request.auth.uid }).lean();
        return serializeDocuments(docs);
    });
    app.post("/api/birthdays", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const date = String(payload.date ?? "");
        const doc = await BirthdayModel.create({
            userId: request.auth.uid,
            name: String(payload.name ?? ""),
            date,
            monthDay: deriveMonthDay(date),
            year: payload.year ? Number(payload.year) : undefined,
            relation: String(payload.relation ?? ""),
            color: String(payload.color ?? "#FF6B6B"),
            notifications: Array.isArray(payload.notifications) ? payload.notifications : [],
            createdAt: new Date(),
        });
        return reply.code(201).send(serializeDocument(doc.toObject()));
    });
    app.put("/api/birthdays/:birthdayId", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const updates = {};
        for (const key of ["name", "relation", "color", "date", "monthDay"]) {
            if (key in payload) {
                updates[key] = String(payload[key] ?? "");
            }
        }
        if ("year" in payload) {
            updates.year = Number(payload.year);
        }
        if ("notifications" in payload && Array.isArray(payload.notifications)) {
            updates.notifications = payload.notifications;
        }
        if ("date" in payload && !("monthDay" in updates)) {
            updates.monthDay = deriveMonthDay(String(payload.date ?? ""));
        }
        if (Object.keys(updates).length === 0) {
            return reply.code(400).send({ error: "No valid fields to update" });
        }
        const updated = await BirthdayModel.findOneAndUpdate({ _id: parseObjectId(String(request.params.birthdayId)), userId: request.auth.uid }, { $set: updates }, { new: true }).lean();
        if (!updated) {
            return reply.code(404).send({ error: "Birthday not found" });
        }
        return serializeDocument(updated);
    });
    app.delete("/api/birthdays/:birthdayId", { preHandler: requireAuth }, async (request, reply) => {
        const deleted = await BirthdayModel.deleteOne({
            _id: parseObjectId(String(request.params.birthdayId)),
            userId: request.auth.uid,
        });
        if (deleted.deletedCount === 0) {
            return reply.code(404).send({ error: "Birthday not found" });
        }
        return { message: "Birthday deleted successfully" };
    });
    app.get("/api/events", { preHandler: requireAuth }, async (request) => {
        const { date } = request.query;
        const query = { userId: request.auth.uid };
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setUTCHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        const docs = await EventModel.find(query).sort({ date: 1 }).lean();
        return serializeDocuments(docs);
    });
    app.post("/api/events", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const date = payload.date ? new Date(String(payload.date)) : new Date();
        const doc = await EventModel.create({
            userId: request.auth.uid,
            title: String(payload.title ?? "Untitled Event"),
            description: String(payload.description ?? ""),
            date,
            time: String(payload.time ?? ""),
            color: String(payload.color ?? "#FF9500"),
            createdAt: new Date(),
        });
        return reply.code(201).send(serializeDocument(doc.toObject()));
    });
    app.put("/api/events/:eventId", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const updates = {};
        for (const key of ["title", "description", "time", "color"]) {
            if (key in payload) {
                updates[key] = String(payload[key] ?? "");
            }
        }
        if ("date" in payload) {
            const parsed = new Date(String(payload.date));
            if (!Number.isNaN(parsed.getTime())) {
                updates.date = parsed;
            }
        }
        if (Object.keys(updates).length === 0) {
            return reply.code(400).send({ error: "No valid fields to update" });
        }
        const updated = await EventModel.findOneAndUpdate({ _id: parseObjectId(String(request.params.eventId)), userId: request.auth.uid }, { $set: updates }, { new: true }).lean();
        if (!updated) {
            return reply.code(404).send({ error: "Event not found" });
        }
        return serializeDocument(updated);
    });
    app.delete("/api/events/:eventId", { preHandler: requireAuth }, async (request, reply) => {
        const deleted = await EventModel.deleteOne({
            _id: parseObjectId(String(request.params.eventId)),
            userId: request.auth.uid,
        });
        if (deleted.deletedCount === 0) {
            return reply.code(404).send({ error: "Event not found" });
        }
        return { message: "Event deleted successfully" };
    });
};
