import { Schema, model } from "mongoose";

const birthdaySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    date: { type: String, default: "" },
    monthDay: { type: String, default: "" },
    year: { type: Number },
    relation: { type: String, default: "" },
    color: { type: String, default: "#FF6B6B" },
    notifications: { type: [Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export const BirthdayModel = model("Birthday", birthdaySchema, "birthdays");
