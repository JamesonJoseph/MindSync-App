import { Schema, model } from "mongoose";

const voiceAnalysisSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    transcript: { type: String, default: "" },
    languageCode: { type: String, default: "unknown" },
    emotion: { type: String, default: "neutral" },
    confidence: { type: Number, default: 0 },
    suggestions: { type: String, default: "" },
    earlyWarning: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

voiceAnalysisSchema.index({ userId: 1, date: -1 });

export const VoiceAnalysisModel = model("VoiceAnalysis", voiceAnalysisSchema, "voice_analyses");
