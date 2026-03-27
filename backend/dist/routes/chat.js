import { parseObjectId } from "../lib/ids.js";
import { normalizeChatMessages, buildConversationTitle, serializeConversationDetail, serializeConversationSummary } from "../services/conversation.js";
import { ChatConversationModel } from "../models/chat-conversation.js";
import { requireAuth } from "../plugins/auth.js";
import { runAssistantChat } from "../services/chat.js";
export const chatRoutes = async (app) => {
    app.post("/api/chat", { preHandler: requireAuth }, async (request) => {
        const payload = request.body;
        const messages = normalizeChatMessages(payload.messages);
        return runAssistantChat({
            uid: request.auth.uid,
            email: request.auth.email,
            messages,
        });
    });
    app.post("/api/chat/save", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const messages = normalizeChatMessages(payload.messages);
        if (messages.length === 0) {
            return reply.code(400).send({ error: "No messages to save" });
        }
        const conversationId = String(payload.conversationId ?? "").trim();
        const conversationDoc = {
            userId: request.auth.uid,
            userEmail: request.auth.email,
            title: buildConversationTitle(messages),
            contextType: String(payload.contextType ?? "general"),
            context: typeof payload.context === "object" && payload.context ? payload.context : {},
            messages,
            updatedAt: new Date(),
        };
        let finalDoc;
        if (conversationId) {
            finalDoc = await ChatConversationModel.findOneAndUpdate({ _id: parseObjectId(conversationId), userId: request.auth.uid }, {
                $set: conversationDoc,
                $setOnInsert: { createdAt: new Date() },
            }, { upsert: true, new: true }).lean();
        }
        else {
            finalDoc = (await ChatConversationModel.create({
                ...conversationDoc,
                createdAt: new Date(),
            })).toObject();
        }
        return serializeConversationDetail(finalDoc);
    });
    app.get("/api/chat/conversations", { preHandler: requireAuth }, async (request) => {
        const { limit = "100" } = request.query;
        const docs = await ChatConversationModel.find({ userId: request.auth.uid })
            .sort({ updatedAt: -1 })
            .limit(Math.min(Number(limit) || 100, 100))
            .lean();
        return docs.map((doc) => serializeConversationSummary(doc));
    });
    app.get("/api/chat/conversations/:conversationId", { preHandler: requireAuth }, async (request, reply) => {
        const doc = await ChatConversationModel.findOne({
            _id: parseObjectId(String(request.params.conversationId)),
            userId: request.auth.uid,
        }).lean();
        if (!doc) {
            return reply.code(404).send({ error: "Conversation not found" });
        }
        return serializeConversationDetail(doc);
    });
    app.put("/api/chat/conversations/:conversationId", { preHandler: requireAuth }, async (request, reply) => {
        const payload = request.body;
        const title = String(payload.title ?? "").trim();
        if (!title) {
            return reply.code(400).send({ error: "No valid fields to update" });
        }
        const updated = await ChatConversationModel.findOneAndUpdate({ _id: parseObjectId(String(request.params.conversationId)), userId: request.auth.uid }, { $set: { title: title.slice(0, 120), updatedAt: new Date() } }, { new: true }).lean();
        if (!updated) {
            return reply.code(404).send({ error: "Conversation not found" });
        }
        return serializeConversationDetail(updated);
    });
    app.delete("/api/chat/conversations/:conversationId", { preHandler: requireAuth }, async (request, reply) => {
        const deleted = await ChatConversationModel.deleteOne({
            _id: parseObjectId(String(request.params.conversationId)),
            userId: request.auth.uid,
        });
        if (deleted.deletedCount === 0) {
            return reply.code(404).send({ error: "Conversation not found" });
        }
        return { message: "Conversation deleted successfully" };
    });
};
