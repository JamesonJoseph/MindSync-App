import { Schema, model } from "mongoose";
const emotionHistorySchema = new Schema({
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    emotion: { type: String, default: "neutral" },
    confidence: { type: Number, default: 0 },
    details: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
}, { versionKey: false });
export const EmotionHistoryModel = model("EmotionHistory", emotionHistorySchema, "emotionhistories");
