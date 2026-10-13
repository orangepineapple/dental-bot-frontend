"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getMe, logout, restoreSession, sendChatMessage, type User } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string; degraded?: boolean };

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            onClick={() => {
              setMessages([]);
              setConversationId(null);
              setError(null);
            }}
            className="text-zinc-600 hover:underline dark:text-zinc-400"
          >
            New chat
          </button>
          <button onClick={onLogout} className="text-zinc-600 hover:underline dark:text-zinc-400">
            Log out
          </button>
        </div>
      </header>

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

      <form
        onSubmit={onSend}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
        />
        <button
          disabled={sending || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
