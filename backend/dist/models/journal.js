import { Schema, model } from "mongoose";
const journalSchema = new Schema({
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    title: { type: String, default: "Untitled Entry" },
    content: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
    sentimentScore: { type: Number, default: 0 },
    aiAnalysis: { type: String, default: "" },
}, { versionKey: false });
journalSchema.index({ userId: 1, date: -1 });
export const JournalModel = model("Journal", journalSchema, "journals");
