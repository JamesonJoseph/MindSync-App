import { Schema, model } from "mongoose";
const userProfileSchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, default: "" },
    name: { type: String, default: "" },
    occupation: { type: String, default: "" },
    sleep: { type: String, default: "" },
    activity: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });
export const UserProfileModel = model("UserProfile", userProfileSchema, "users");
