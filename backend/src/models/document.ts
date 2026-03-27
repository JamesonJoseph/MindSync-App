import { Schema, model } from "mongoose";

const documentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    title: { type: String, default: "Untitled Document" },
    content: { type: String, default: "" },
    type: { type: String, default: "note" },
    date: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

documentSchema.index({ userId: 1, date: -1 });

export const DocumentModel = model("Document", documentSchema, "documents");
