import { Schema, model } from "mongoose";

const eventSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "Untitled Event" },
    description: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
    time: { type: String, default: "" },
    color: { type: String, default: "#FF9500" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

eventSchema.index({ userId: 1, date: 1 });

export const EventModel = model("Event", eventSchema, "events");
