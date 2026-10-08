"use client";

import { useState, useCallback } from "react";

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

  const sendMessage = useCallback(async (content: string, vehicleContext?: VehicleContext) => {
    const sessionId = getSessionId();

    setMessages((p) => [
      ...p,
      { id: makeId(), role: "user", content, timestamp: new Date().toISOString() },
    ]);
    setIsLoading(true);

    const aiId = makeId();
    setMessages((p) => [
      ...p,
      { id: aiId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: content, vehicle_context: vehicleContext }),
      });

      if (!res.ok) throw new Error("failed");
      const payload: { response?: string } = await res.json();
      setMessages((prev) =>
        prev.map((message) =>
          message.id === aiId
            ? { ...message, content: payload.response || "Mình chưa nhận được câu trả lời. Vui lòng thử lại." }
            : message
        )
      );
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.id === aiId
            ? { ...m, content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendWithContext = useCallback(
    (contextText: string, vehicleContext?: VehicleContext) => sendMessage(contextText, vehicleContext),
    [sendMessage]
  );

  return { messages, sendMessage, sendWithContext, isLoading };
}
