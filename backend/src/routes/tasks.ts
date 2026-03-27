import type { FastifyPluginAsync } from "fastify";
import { parseObjectId } from "../lib/ids.js";
import { serializeDocument, serializeDocuments } from "../lib/serialization.js";
import { normalizeAllDayDate, parseIsoDateTime, utcNow } from "../lib/time.js";
import { TaskModel } from "../models/task.js";
import { requireAuth } from "../plugins/auth.js";

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/tasks", { preHandler: requireAuth }, async (request) => {
    const docs = await TaskModel.find({ userId: request.auth.uid }).sort({ event_datetime: 1 }).lean();
    return serializeDocuments(docs);
  });

  app.post("/api/tasks", { preHandler: requireAuth }, async (request, reply) => {
    const payload = request.body as Record<string, unknown>;
    const isAllDay = Boolean(payload.allDay ?? true);
    const eventDatetime =
      (isAllDay ? normalizeAllDayDate(payload.event_datetime) : parseIsoDateTime(String(payload.event_datetime ?? ""))) ?? utcNow();
    const reminderMinutes = Number(payload.reminder_minutes ?? 30);
    const reminderDatetime =
      parseIsoDateTime(String(payload.reminder_datetime ?? "")) ?? new Date(eventDatetime.getTime() - reminderMinutes * 60 * 1000);

    const doc = await TaskModel.create({
      userId: request.auth.uid,
      userEmail: request.auth.email,
      id: Number(payload.id ?? Date.now()),
      title: String(payload.title ?? "Untitled"),
      description: String(payload.description ?? ""),
      type: String(payload.type ?? "task"),
      allDay: Boolean(payload.allDay ?? true),
      event_datetime: eventDatetime,
      reminder_minutes: reminderMinutes,
      reminder_datetime: reminderDatetime,
      status: String(payload.status ?? "pending"),
      priority: String(payload.priority ?? "medium"),
      time: String(payload.time ?? ""),
      created_at: parseIsoDateTime(String(payload.created_at ?? "")) ?? utcNow(),
    });

    return reply.code(201).send(serializeDocument(doc.toObject()));
  });

  app.put("/api/tasks/:taskId", { preHandler: requireAuth }, async (request, reply) => {
    const taskId = String((request.params as { taskId: string }).taskId);
    const payload = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const key of ["title", "description", "type", "status", "priority", "time"]) {
      if (key in payload) {
        updates[key] = String(payload[key] ?? "");
      }
    }

    if ("allDay" in payload) {
      updates.allDay = Boolean(payload.allDay);
    }
    if ("reminder_minutes" in payload) {
      updates.reminder_minutes = Number(payload.reminder_minutes);
    }

    const currentTask =
      "event_datetime" in payload && !("allDay" in updates)
        ? await TaskModel.findOne({ _id: parseObjectId(taskId), userId: request.auth.uid }).lean()
        : null;
    const nextAllDay = "allDay" in updates ? Boolean(updates.allDay) : Boolean(currentTask?.allDay ?? true);
    const eventDatetime =
      "event_datetime" in payload
        ? nextAllDay === false
          ? parseIsoDateTime(String(payload.event_datetime ?? ""))
          : normalizeAllDayDate(payload.event_datetime)
        : null;
    const reminderDatetime = "reminder_datetime" in payload ? parseIsoDateTime(String(payload.reminder_datetime ?? "")) : null;

    if (eventDatetime) {
      updates.event_datetime = eventDatetime;
    }
    if (reminderDatetime) {
      updates.reminder_datetime = reminderDatetime;
    } else if (eventDatetime && "reminder_minutes" in updates) {
      updates.reminder_datetime = new Date(eventDatetime.getTime() - Number(updates.reminder_minutes) * 60 * 1000);
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    const updated = await TaskModel.findOneAndUpdate(
      { _id: parseObjectId(taskId), userId: request.auth.uid },
      { $set: updates },
      { new: true },
    ).lean();

    if (!updated) {
      return reply.code(404).send({ error: "Task not found" });
    }

    return serializeDocument(updated);
  });

  app.delete("/api/tasks/:taskId", { preHandler: requireAuth }, async (request, reply) => {
    const deleted = await TaskModel.deleteOne({
      _id: parseObjectId(String((request.params as { taskId: string }).taskId)),
      userId: request.auth.uid,
    });

    if (deleted.deletedCount === 0) {
      return reply.code(404).send({ error: "Task not found" });
    }

    return { message: "Task deleted successfully" };
  });
};
