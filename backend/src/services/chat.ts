import { loadPrompt } from "../lib/prompts.js";
import { serializeDocuments } from "../lib/serialization.js";
import { normalizeAllDayDate, parseIsoDateTime, utcNow } from "../lib/time.js";
import { JournalModel } from "../models/journal.js";
import { TaskModel } from "../models/task.js";
import { groqService } from "./groq.js";
import type { ChatMessage } from "./conversation.js";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_tasks",
      description: "Get all tasks for the current user.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a task for the current user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          event_datetime: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description: "Update a task status for the current user.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          status: { type: "string" },
        },
        required: ["task_id", "status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_journals",
      description: "Get recent journals for the current user.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export async function runAssistantChat(input: {
  uid: string;
  email: string;
  messages: ChatMessage[];
}): Promise<{ role: "assistant"; content: string }> {
  const systemPrompt = loadPrompt("chat-system.md");
  try {
    const initialResponse = (await groqService.createToolCallingResponse({
      systemPrompt,
      messages: input.messages,
      tools,
    })) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function?: {
              name?: string;
              arguments?: string;
            };
          }>;
        };
      }>;
    };

    const firstChoice = initialResponse.choices?.[0]?.message;
    const toolCalls = firstChoice?.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        role: "assistant",
        content: String(firstChoice?.content ?? ""),
      };
    }

    const toolMessages: ChatMessage[] = [...input.messages];

    for (const toolCall of toolCalls) {
      const functionName = String(toolCall.function?.name ?? "");
      let args: Record<string, unknown> = {};

      try {
        args = JSON.parse(String(toolCall.function?.arguments ?? "{}")) as Record<string, unknown>;
      } catch {
        args = {};
      }

      let toolResponse: unknown = { error: "Unknown function" };

      if (functionName === "get_tasks") {
        const docs = await TaskModel.find({ userId: input.uid }).sort({ event_datetime: 1 }).limit(10).lean();
        toolResponse = serializeDocuments(docs);
      }

      if (functionName === "create_task") {
        const eventDatetime =
          normalizeAllDayDate(args.event_datetime) ?? parseIsoDateTime(String(args.event_datetime ?? "")) ?? utcNow();
        const task = await TaskModel.create({
          userId: input.uid,
          userEmail: input.email,
          id: Date.now(),
          title: String(args.title ?? "Untitled"),
          description: String(args.description ?? ""),
          type: "task",
          allDay: true,
          event_datetime: eventDatetime,
          reminder_minutes: 30,
          reminder_datetime: new Date(eventDatetime.getTime() - 30 * 60 * 1000),
          status: String(args.status ?? "pending"),
          priority: String(args.priority ?? "medium"),
          time: "",
          created_at: utcNow(),
        });
        toolResponse = { status: "success", taskId: String(task._id) };
      }

      if (functionName === "update_task") {
        const updated = await TaskModel.updateOne(
          { _id: String(args.task_id ?? ""), userId: input.uid },
          { $set: { status: String(args.status ?? "pending") } },
        );
        toolResponse = updated.matchedCount > 0 ? { status: "success" } : { status: "error", message: "Invalid task ID" };
      }

      if (functionName === "get_journals") {
        const docs = await JournalModel.find({ userId: input.uid }).sort({ date: -1 }).limit(5).lean();
        toolResponse = serializeDocuments(docs);
      }

      toolMessages.push({
        role: "tool",
        content: JSON.stringify({ toolCallId: toolCall.id, functionName, result: toolResponse }),
        tool_call_id: toolCall.id,
      });
    }

    const finalText = await groqService.generateText({
      systemPrompt,
      messages: toolMessages,
    });

    return {
      role: "assistant",
      content: finalText,
    };
  } catch {
    const fallbackText = await groqService.generateText({
      systemPrompt,
      messages: input.messages,
    });

    return {
      role: "assistant",
      content: fallbackText,
    };
  }
}
