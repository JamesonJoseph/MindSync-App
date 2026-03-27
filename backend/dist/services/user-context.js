import { JournalModel } from "../models/journal.js";
import { TaskModel } from "../models/task.js";
import { UserProfileModel } from "../models/user-profile.js";
import { VoiceAnalysisModel } from "../models/voice-analysis.js";
export async function getUserContext(userId) {
    const [recentJournals, recentTasks, profile, recentVoice] = await Promise.all([
        JournalModel.find({ userId }).sort({ date: -1 }).limit(5).lean(),
        TaskModel.find({ userId }).sort({ created_at: -1 }).limit(10).lean(),
        UserProfileModel.findOne({ userId }).lean(),
        VoiceAnalysisModel.find({ userId }).sort({ date: -1 }).limit(5).lean(),
    ]);
    return {
        userId,
        name: String(profile?.name ?? "User"),
        occupation: String(profile?.occupation ?? "Not specified"),
        sleep: String(profile?.sleep ?? "Not specified"),
        activity: String(profile?.activity ?? "Not specified"),
        recent_journals: recentJournals.length > 0
            ? recentJournals
                .map((journal) => `- ${String(journal.title ?? "")}: ${String(journal.content ?? "").slice(0, 180)}`)
                .join("\n")
            : "No recent entries",
        recent_tasks: recentTasks.length > 0
            ? recentTasks.map((task) => `- ${String(task.title ?? "Untitled")} (${String(task.status ?? "pending")})`).join("\n")
            : "No recent tasks",
        recent_voice: recentVoice.length > 0
            ? recentVoice.map((voice) => `- ${String(voice.emotion ?? "neutral")} (${Number(voice.confidence ?? 0)}%)`).join("\n")
            : "No recent voice analyses",
    };
}
