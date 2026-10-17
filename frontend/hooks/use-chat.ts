"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ensureCustomerSession } from "@/lib/customer-session";

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

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const id = await ensureCustomerSession();
        const res = await fetch("/api/chat/history?session_id=" + encodeURIComponent(id), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.messages && !pending.current) {
          setMessages((current) =>
            current.length
              ? current
              : data.messages.map(
                  (m: { role: "user" | "assistant"; content: string }, index: number) => ({
                    ...m,
                    id: id + index,
                    timestamp: "",
                  })
                )
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    void loadHistory();
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
      const sessionId = await ensureCustomerSession();
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
