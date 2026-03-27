export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
};

export function normalizeChatMessages(rawMessages: unknown): ChatMessage[] {
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const role = String((item as Record<string, unknown>).role ?? "").toLowerCase();
    const content = String((item as Record<string, unknown>).content ?? "");

    if (!["user", "assistant", "system", "tool"].includes(role)) {
      return [];
    }

    return [{ role: role as ChatMessage["role"], content }];
  });
}

export function buildConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  return firstUserMessage ? firstUserMessage.content.trim().slice(0, 80) : "MindSync Chat";
}

export function serializeConversationSummary(doc: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(doc.messages) ? (doc.messages as ChatMessage[]) : [];
  const lastMessage = messages.at(-1);

  return {
    _id: String(doc._id ?? ""),
    title: String(doc.title ?? "MindSync Chat"),
    contextType: String(doc.contextType ?? "general"),
    messageCount: messages.length,
    lastMessage: String(lastMessage?.content ?? "").slice(0, 140),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

export function serializeConversationDetail(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    ...serializeConversationSummary(doc),
    context: typeof doc.context === "object" && doc.context ? doc.context : {},
    messages: normalizeChatMessages(doc.messages),
  };
}
