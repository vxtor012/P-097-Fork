"use client";

import { useState, useCallback, useRef } from "react";

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
}

function makeId() {
  return Math.random().toString(36).slice(2, 11);
}

function getSessionId() {
  if (typeof window === "undefined") return makeId();
  const k = "vf_session";
  const v = sessionStorage.getItem(k);
  if (v) return v;
  const id = makeId();
  sessionStorage.setItem(k, id);
  return id;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pending = useRef(false);

  const sendMessage = useCallback(async (content: string, vehicleContext?: VehicleContext) => {
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

      const payload: { response?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(payload.error || "AI chưa sẵn sàng. Vui lòng thử lại.");
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
