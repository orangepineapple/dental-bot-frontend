"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CONVERSATION_MESSAGES,
  getConversationMessages,
  getMe,
  listConversations,
  logout,
  restoreSession,
  sendChatMessage,
  type ConversationSummary,
  type User,
} from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; degraded?: boolean };

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await restoreSession())) return router.replace("/login");
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const isFull = messages.length + 2 > MAX_CONVERSATION_MESSAGES;

  async function openHistory() {
    setShowHistory(true);
    setLoadingHistory(true);
    setError(null);
    try {
      setConversations(await listConversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chats");
    } finally {
      setLoadingHistory(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setShowHistory(false);
  }

  async function resumeChat(id: string) {
    setLoadingHistory(true);
    setError(null);
    try {
      const transcript = await getConversationMessages(id);
      setMessages(transcript.map((m) => ({ role: m.role, content: m.content })));
      setConversationId(id);
      setShowHistory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chat");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await sendChatMessage(text, conversationId);
      setConversationId(res.conversation_id);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply, degraded: res.degraded },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user) {
    return <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</main>;
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h1 className="font-semibold">Dental Clinic Assistant</h1>
          <p className="text-xs text-zinc-500">Signed in as {user.patient.first_name}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button
            onClick={() => (showHistory ? setShowHistory(false) : openHistory())}
            className="text-zinc-600 hover:underline dark:text-zinc-400"
          >
            {showHistory ? "Back to chat" : "Past chats"}
          </button>
          <button
            onClick={startNewChat}
            className="text-zinc-600 hover:underline dark:text-zinc-400"
          >
            New chat
          </button>
          <button onClick={onLogout} className="text-zinc-600 hover:underline dark:text-zinc-400">
            Log out
          </button>
        </div>
      </header>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loadingHistory && <p className="text-sm text-zinc-500">Loading…</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {!loadingHistory && conversations?.length === 0 && (
            <p className="pt-10 text-center text-sm text-zinc-500">No past chats yet.</p>
          )}
          <ul className="space-y-2">
            {conversations?.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => resumeChat(c.id)}
                  disabled={loadingHistory}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-900 ${
                    c.id === conversationId
                      ? "border-blue-500"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(c.updated_at).toLocaleString()} · {c.message_count}/
                    {MAX_CONVERSATION_MESSAGES} messages
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
      <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-zinc-500">
            Ask about appointments, e.g. &ldquo;I&rsquo;d like to book a cleaning next week.&rdquo;
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : m.degraded
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="text-sm text-zinc-500">Assistant is typing…</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {isFull && (
        <p className="px-4 pb-2 text-center text-xs text-amber-700 dark:text-amber-400">
          This chat has reached its {MAX_CONVERSATION_MESSAGES}-message limit.{" "}
          <button onClick={startNewChat} className="underline">
            Start a new chat
          </button>
        </p>
      )}
      <form
        onSubmit={onSend}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          disabled={isFull}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
        />
        <button
          disabled={sending || isFull || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      </>
      )}
    </div>
  );
}
