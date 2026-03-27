import mongoose from "mongoose";

export function parseObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid document id format.");
  }

  return new mongoose.Types.ObjectId(id);
}
