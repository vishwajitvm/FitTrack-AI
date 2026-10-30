import useSWR from "swr";
import { api } from "@/lib/api";
import type { ChatAnswer, ChatTurn, Conversation, StoredMessage } from "@/lib/types";

export function useAssistantSuggestions() {
  return useSWR<{ suggestions: string[] }>("/api/assistant/suggestions");
}

/** Every stored conversation, newest first. */
export function useConversations() {
  return useSWR<Conversation[]>("/api/assistant/conversations");
}

export function getConversation(id: string) {
  return api.get<{ id: string; messages: StoredMessage[] }>(`/api/assistant/conversations/${id}`);
}

/** Asks and stores the turn; pass the conversation id to continue one (null starts a new conversation). */
export function askAssistant(message: string, history: ChatTurn[], conversationId: string | null) {
  return api.post<ChatAnswer>("/api/assistant/chat", { message, history, conversation_id: conversationId });
}

/** Saves a conversation kept in this browser (before chats were stored on the server). */
export function importConversation(messages: { role: "user" | "assistant"; content: string; meta?: object }[]) {
  return api.post<{ conversation_id: string | null; imported: number; skipped: boolean }>("/api/assistant/import", { messages });
}
