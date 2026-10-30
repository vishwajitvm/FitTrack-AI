"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Beef, Bot, Dumbbell, Flame, History, Info, MessageCirclePlus, Moon, Sparkles, TrendingDown, User, Utensils, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { Select, Textarea } from "@/components/ui/input";
import { askAssistant, getConversation, importConversation, useAssistantSuggestions, useConversations } from "@/hooks/use-assistant";
import { prettyDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ChatAnswer, ChatTurn, StoredMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

interface Message extends ChatTurn {
  id: string;
  meta?: Partial<Omit<ChatAnswer, "answer">>;
}

/** Chats used to live only in this browser; they are moved to the server once, then removed here. */
const LEGACY_KEY = "fittrack.assistant.chat";
/** Which conversation was open last (a per-browser convenience; the chats themselves are on the server). */
const OPEN_KEY = "fittrack.assistant.open";

function storage(get: () => string | null): string | null {
  try {
    return get();
  } catch {
    return null;
  }
}

async function migrateLegacyChat() {
  const raw = storage(() => localStorage.getItem(LEGACY_KEY));
  if (!raw) return;
  try {
    const old = JSON.parse(raw) as Message[];
    const turns = old.filter((m) => m.content).map(({ role, content, meta }) => ({ role, content, meta: meta ?? {} }));
    if (turns.length) await importConversation(turns);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* keep the local copy and try again next time */
  }
}

const fromStored = (m: StoredMessage): Message => ({ id: String(m.id), role: m.role, content: m.content, meta: m.role === "assistant" ? m.meta : undefined });

const uid = () => Math.random().toString(36).slice(2, 10);

/** Icon and colour for a suggested question, by what it is about. */
function topicOf(q: string): { accent: Accent; Icon: LucideIcon; tag: string } {
  const t = q.toLowerCase();
  // specific topics first: "protein target" is about protein, not weight progress
  if (/protein/.test(t)) return { accent: "protein", Icon: Beef, tag: "Protein" };
  if (/(lose|target|rate|reach)/.test(t)) return { accent: "balance", Icon: TrendingDown, tag: "Progress" };
  if (/(gym|workout|train|exercise)/.test(t)) return { accent: "burn", Icon: Dumbbell, tag: "Training" };
  if (/(sleep|energy|mood)/.test(t)) return { accent: "sleep", Icon: Moon, tag: "Recovery" };
  if (/(eat|ate|food|meal)/.test(t)) return { accent: "kcal", Icon: Utensils, tag: "Food" };
  if (/(deficit|calorie|kcal)/.test(t)) return { accent: "kcal", Icon: Flame, tag: "Calories" };
  return { accent: "weight", Icon: Sparkles, tag: "Ask" };
}

export function AssistantView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: sugg } = useAssistantSuggestions();
  const { data: conversations, mutate: refreshConversations } = useConversations();
  const params = useSearchParams();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askedFromUrl = useRef(false);

  const open = async (id: string | null) => {
    setConversationId(id);
    try {
      if (id) localStorage.setItem(OPEN_KEY, id);
      else localStorage.removeItem(OPEN_KEY);
    } catch {
      /* storage unavailable */
    }
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const c = await getConversation(id);
      setMessages(c.messages.map(fromStored));
    } catch (err) {
      notify.error(err, "Could not open that chat");
      setConversationId(null);
      setMessages([]);
    }
  };

  // First visit: move any chat kept in this browser to the server, then reopen the last conversation.
  useEffect(() => {
    void (async () => {
      await migrateLegacyChat();
      const list = await refreshConversations();
      if (params.get("q")) return; // "Ask about this day" starts a fresh chat
      const last = storage(() => localStorage.getItem(OPEN_KEY));
      const target = list?.find((c) => c.id === last)?.id ?? list?.[0]?.id ?? null;
      if (target) await open(target);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must return nothing.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
    const next = [...messages, { id: uid(), role: "user" as const, content: message }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { answer, ...meta } = await askAssistant(message, history, conversationId);
      setMessages([...next, { id: uid(), role: "assistant" as const, content: answer, meta }]);
      if (meta.conversation_id && meta.conversation_id !== conversationId) void open(meta.conversation_id).then(() => undefined);
      void refreshConversations();
    } catch (err) {
      notify.error(err, "Could not get an answer");
      setMessages(messages);
      setInput(message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // "Ask about this day" from History arrives as ?q=…
  useEffect(() => {
    const q = params.get("q");
    if (q && !askedFromUrl.current) {
      askedFromUrl.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Nothing is deleted: earlier chats stay under "Past chats".
  const newChat = () => {
    void open(null);
    notify.success("New chat started", "Your earlier chats are kept under Past chats.");
    inputRef.current?.focus();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const last = messages[messages.length - 1];
  const followUps = !busy && last?.role === "assistant" ? last.meta?.suggestions ?? [] : [];

  return (
    // Fills the screen (minus the top bar and mobile nav) so the conversation scrolls inside and the input stays in view.
    <div className="flex h-[calc(100dvh-9rem)] min-h-[440px] flex-col lg:h-[calc(100dvh-4.5rem)]">
      <PageHeader
        title="Ask FitTrack"
        page="ask"
        description="Ask about your own food, training, weight and recovery in plain words. Every number comes from your logs; projections use energy balance (7,700 kcal ≈ 1 kg)."
        actions={
          <>
            {conversations && conversations.length > 0 && (
              <label className="flex min-w-0 flex-1 items-center gap-2 xl:flex-none">
                <History className="h-4 w-4 text-slate-400" aria-hidden />
                <span className="sr-only">Past chats</span>
                <Select value={conversationId ?? ""} onChange={(e) => void open(e.target.value || null)} disabled={busy} className="h-11 min-w-0 flex-1 sm:w-[260px] sm:flex-none">
                  <option value="">{conversationId ? "Past chats…" : "New chat"}</option>
                  {conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {prettyDate(c.updated_at, { day: "numeric", month: "short" })} · {c.title}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {messages.length > 0 && (
              <Button variant="outline" className="min-h-[44px] shrink-0" onClick={newChat} disabled={busy} aria-label="New chat">
                <MessageCirclePlus className="h-4 w-4" /> <span className="hidden sm:inline">New chat</span>
              </Button>
            )}
          </>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {messages.length === 0 && !busy ? (
            <Welcome suggestions={sugg?.suggestions ?? []} onPick={send} />
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} />)
          )}
          {busy && <Thinking />}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line bg-slate-50/60 px-4 py-3 sm:px-6">
          {followUps.length > 0 && (
            <div className="scrollbar-thin mb-2 flex gap-2 overflow-x-auto pb-1">
              {followUps.map((s) => (
                <FollowUp key={s} text={s} onPick={send} />
              ))}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask anything — e.g. “what did I eat last Monday?”"
              className="max-h-40 min-h-[44px] resize-none"
              aria-label="Your question"
            />
            <Button type="submit" size="icon" className="h-11 w-11" loading={busy} disabled={!input.trim()} aria-label="Send">
              {!busy && <ArrowUp className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line · Not medical advice.</p>
        </div>
      </Card>
    </div>
  );
}

function Welcome({ suggestions, onPick }: { suggestions: string[]; onPick: (q: string) => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-4 text-center sm:py-8">
      <span className="fade-up relative mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-hero text-white shadow-sm">
        <Sparkles className="h-8 w-8" />
        <span className="absolute -inset-1 -z-10 animate-pulse rounded-[28px] bg-emerald-400/30 blur-md" aria-hidden />
      </span>
      <h2 className="fade-up text-2xl font-bold text-slate-900" style={{ animationDelay: "60ms" }}>
        What would you like to <span className="text-hero">know</span>?
      </h2>
      <p className="fade-up mt-1 max-w-lg text-sm text-slate-500" style={{ animationDelay: "120ms" }}>
        I answer from your own logs — meals, workouts, weigh-ins and check-ins — and show the numbers behind it.
      </p>
      <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
        {suggestions.map((s, i) => {
          const { accent, Icon, tag } = topicOf(s);
          const a = ACCENT[accent];
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              style={{ animationDelay: `${160 + i * 50}ms` }}
              className={cn("fade-up lift group flex items-start gap-3 rounded-2xl border bg-card px-4 py-3 text-left shadow-card", a.border)}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110", a.tint, a.text)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[11px] font-semibold", a.text)}>{tag}</span>
                <span className="block text-sm font-medium text-slate-800">{s}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="fade-up flex justify-end gap-2.5">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-navy px-4 py-2.5 text-sm text-white shadow-sm">{message.content}</p>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <User className="h-4 w-4" />
        </span>
      </div>
    );
  }
  const meta = message.meta;
  return (
    <div className="fade-up flex gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hero text-white">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[92%] flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-line border-l-4 border-l-acc-balance bg-card px-4 py-3 shadow-card">
          <Markdown text={message.content} />
        </div>
        {meta && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
            {meta.mode === "offline" ? <Badge tone="warning">Built-in answer</Badge> : meta.model && <Badge tone="neutral">{meta.model}</Badge>}
            <span>{meta.basis}</span>
          </div>
        )}
        {meta?.notice && (
          <p className={cn("flex items-start gap-1.5 px-1 text-[11px] text-slate-500")}>
            <Info className="mt-px h-3 w-3 shrink-0" /> {meta.notice}
          </p>
        )}
      </div>
    </div>
  );
}

function FollowUp({ text, onPick }: { text: string; onPick: (q: string) => void }) {
  const { accent, Icon } = topicOf(text);
  const a = ACCENT[accent];
  return (
    <button
      type="button"
      onClick={() => onPick(text)}
      className={cn("inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:-translate-y-0.5 hover:text-slate-900", a.border)}
    >
      <Icon className={cn("h-3.5 w-3.5", a.text)} />
      {text}
    </button>
  );
}

function Thinking() {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-full bg-hero text-white">
        <Bot className="h-4 w-4" />
      </span>
      <div className="rounded-2xl rounded-tl-sm border border-line bg-card px-4 py-3 text-sm text-slate-500 shadow-card">
        <span className="inline-flex items-center gap-1">
          Checking your logs
          <span className="inline-flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-acc-balance" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}
