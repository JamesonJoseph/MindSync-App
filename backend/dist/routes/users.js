import { serializeDocument } from "../lib/serialization.js";
import { UserProfileModel } from "../models/user-profile.js";
import { requireAuth } from "../plugins/auth.js";
import { getUserContext } from "../services/user-context.js";
export const userRoutes = async (app) => {
    app.get("/api/user/profile", { preHandler: requireAuth }, async (request) => {
        return getUserContext(request.auth.uid);
    });
    app.put("/api/user/profile", { preHandler: requireAuth }, async (request) => {
        const payload = request.body;
        const profile = await UserProfileModel.findOneAndUpdate({ userId: request.auth.uid }, {
            $set: {
                userId: request.auth.uid,
                userEmail: request.auth.email,
                name: String(payload.name ?? ""),
                occupation: String(payload.occupation ?? ""),
                sleep: String(payload.sleep ?? ""),
                activity: String(payload.activity ?? ""),
                updatedAt: new Date(),
            },
        }, { upsert: true, new: true }).lean();
        return {
            message: "Profile updated successfully",
            profile: serializeDocument(profile),
        };
    });
};
