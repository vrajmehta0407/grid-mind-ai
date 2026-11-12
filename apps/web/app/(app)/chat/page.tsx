"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { apiFetch } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  tools_used?: string[];
  citations?: string[];
}

const SUGGESTED_QUESTIONS = [
  "Why was my last bill high?",
  "What if I run the AC 2 hours less?",
  "What is my next month forecast?",
  "How can I save the most money?",
  "Explain my tariff slabs",
];

export default function ChatPage() {
  const { userId } = useGridMindStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Ask me anything about your electricity bills, tariff slabs, next-month forecast, waste findings, or what-if scenarios. Every figure comes strictly from your data and the Tariff Engine.",
    },
  ]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch<{ answer: string; tools_used: string[]; citations: string[] }>(
        "/api/chat",
        {
          method: "POST",
          body: JSON.stringify({ message: trimmed }),
        },
        userId
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.answer,
          tools_used: res.tools_used,
          citations: res.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Unable to reach the assistant right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-bold text-ink">GridMind Assistant</h1>
          <p className="text-sm text-ink/70">
            Tool-grounded answers over your own bills, forecasts, findings, and Tariff Engine.
          </p>
        </div>

        <GlassCard variant="strong" interactive={false} className="p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="rounded-full bg-violet/10 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-lime transition"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="h-[380px] space-y-3 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-violet text-white"
                      : "bg-white/85 text-ink border border-violet/15"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.tools_used && m.tools_used.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.tools_used.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-0.5 font-mono text-[10px] font-bold text-ink"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs font-medium text-ink/60">Checking your tools...</div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your bill, forecast, or a what-if..."
              className="flex-1 rounded-full border border-violet/25 bg-white/85 px-5 py-3 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </GlassCard>
      </div>
    </AppShell>
  );
}

