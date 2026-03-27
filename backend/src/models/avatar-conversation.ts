import { Schema, model } from "mongoose";

const avatarConversationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: "" },
    user_query: { type: String, default: "" },
    assistant_response: { type: String, default: "" },
    date: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

avatarConversationSchema.index({ userId: 1, date: -1 });

export const AvatarConversationModel = model("AvatarConversation", avatarConversationSchema, "avatar_conversations");
