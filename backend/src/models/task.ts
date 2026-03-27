import { Schema, model } from "mongoose";

const taskSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    id: { type: Number, index: true },
    title: { type: String, default: "Untitled" },
    description: { type: String, default: "" },
    type: { type: String, default: "task" },
    allDay: { type: Boolean, default: true },
    event_datetime: { type: Date, default: Date.now, index: true },
    reminder_minutes: { type: Number, default: 30 },
    reminder_datetime: { type: Date, default: Date.now },
    status: { type: String, default: "pending" },
    priority: { type: String, default: "medium" },
    time: { type: String, default: "" },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

taskSchema.index({ userId: 1, event_datetime: 1 });

export const TaskModel = model("Task", taskSchema, "tasks");
