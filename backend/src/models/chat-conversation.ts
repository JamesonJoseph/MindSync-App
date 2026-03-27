import { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, required: true },
    content: { type: String, default: "" },
  },
  { _id: false, versionKey: false },
);

const chatConversationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    title: { type: String, default: "MindSync Chat" },
    contextType: { type: String, default: "general" },
    context: { type: Schema.Types.Mixed, default: {} },
    messages: { type: [messageSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

chatConversationSchema.index({ userId: 1, updatedAt: -1 });

export const ChatConversationModel = model("ChatConversation", chatConversationSchema, "chat_conversations");
