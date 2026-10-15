"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface VehicleContext {
  model: string;
  version: string;
  color: string;
  province: string;
  battery: "buy" | "rent";
  accessories: string[];
  dealer_id?: string;
}

export interface ConfigurationUpdate {
  model: string; version: string; color: string; province: string;
  battery: 'buy' | 'rent'; accessories: string[]; dealer_id: string | null;
}

function makeId() {
  return Math.random().toString(36).slice(2, 11);
}

function getSessionId() {
  if (typeof window === "undefined") return makeId();
  const k = "vf_session";
  const v = sessionStorage.getItem(k);
  if (v && /^[0-9a-f-]{36}$/i.test(v)) return v;
  const id = crypto.randomUUID();
  sessionStorage.setItem(k, id);
  return id;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const id = getSessionId();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    const controller = new AbortController();
    fetch('/api/chat/history?session_id=' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.messages && !pending.current) setMessages((current) => current.length ? current :
          data.messages.map((m: { role: 'user' | 'assistant'; content: string }, index: number) => ({ ...m, id: id + index, timestamp: '' })));
      }).catch(() => {});
    return () => controller.abort();
  }, []);

  const sendMessage = useCallback(async (content: string, vehicleContext?: VehicleContext,
    applyUpdate?: (update: ConfigurationUpdate) => void) => {
    content = content.trim();
    if (!content || pending.current) return;
    pending.current = true;

    setMessages((p) => [
      ...p,
      { id: makeId(), role: "user", content, timestamp: new Date().toISOString() },
    ]);
    setIsLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65_000);
    const appendReply = (reply: string) => setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "assistant", content: reply, timestamp: new Date().toISOString() },
    ]);

    try {
      const sessionId = getSessionId();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: content, vehicle_context: vehicleContext }),
        signal: controller.signal,
      });

      const payload: { response?: string; error?: string; configuration_update?: ConfigurationUpdate } = await res.json();
      if (!res.ok) throw new Error(payload.error || "AI chưa sẵn sàng. Vui lòng thử lại.");
      if (payload.configuration_update) applyUpdate?.(payload.configuration_update);
      appendReply(payload.response?.trim() || "Mình chưa nhận được câu trả lời. Vui lòng thử lại.");
    } catch (error) {
      appendReply(controller.signal.aborted
        ? "AI phản hồi quá lâu. Vui lòng thử lại sau ít phút."
        : error instanceof Error && error.message !== "Failed to fetch"
          && !(error instanceof SyntaxError)
          ? error.message
          : "Không thể kết nối AI. Vui lòng thử lại sau ít phút.");
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setIsLoading(false);
    }
  }, []);

  const sendWithContext = useCallback(
    (contextText: string, vehicleContext?: VehicleContext) => sendMessage(contextText, vehicleContext),
    [sendMessage]
  );

  return { messages, sendMessage, sendWithContext, isLoading };
}
