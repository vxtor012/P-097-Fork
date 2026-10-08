"use client";

import { useRef, useEffect, useState } from "react";
import { Send, Bot, Car } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useConfigurator } from "@/hooks/use-configurator";
import { VEHICLES } from "@/lib/vehicle-data";
import { formatVND } from "@/lib/format";
import ReactMarkdown from "react-markdown";

const QUICK_ASKS = [
  "Tư vấn thêm về dòng xe này",
  "So sánh mua pin vs thuê pin",
  "Tính trả góp 60 tháng VPBank",
  "Đại lý nào gần nhất?",
  "Chính sách bảo hành như thế nào?",
];

interface Props {
  chat: ReturnType<typeof useChat>;
  configurator: ReturnType<typeof useConfigurator>;
}

export function ChatPanel({ chat, configurator }: Props) {
  const { messages, sendMessage, isLoading } = chat;
  const { pricing, config } = configurator;
  const vehicle = VEHICLES[config.model];
  const vehicleContext = {
    model: vehicle.label,
    version: pricing.version.label,
    color: pricing.color.label,
    province: pricing.province.label,
    battery: config.battery,
    accessories: pricing.accList.map((accessory) => accessory.label),
  };
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const t = input.trim();
    if (!t || isLoading) return;
    sendMessage(t, vehicleContext);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">VinFast AI</p>
            <p className="text-xs text-gray-500">Tư vấn viên thông minh</p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Online
          </span>
        </div>

        {/* Context chip — hiện xe đang xem */}
        <div className="mt-3 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <Car size={14} className="text-blue-600 shrink-0" />
            <span>{config.model} {pricing.version.label} · {pricing.province.label}</span>
          </span>
          <span className="font-semibold">{formatVND(pricing.finalPrice)}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <Bubble key={msg.id} message={msg} />
          ))
        )}
        {isLoading && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* Quick asks */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-2">Câu hỏi gợi ý:</p>
          <div className="flex flex-col gap-1.5">
            {QUICK_ASKS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q, vehicleContext)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 transition-all text-gray-600"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
            placeholder="Hỏi về xe, giá, trả góp..."
            rows={1}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-28 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Giá tham khảo · Xác nhận với đại lý
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 pb-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
        <Bot size={28} className="text-blue-600" />
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">Xin chào!</p>
        <p className="text-xs text-gray-500 mt-1 max-w-[200px] leading-relaxed">
          Hỏi tôi bất cứ điều gì về xe bạn đang xem, tôi sẽ tư vấn ngay!
        </p>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ReturnType<typeof useChat>["messages"][0] }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mb-1">
          <Bot size={13} className="text-blue-600" />
        </div>
      )}
      <div
        className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white border text-gray-800 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-3 space-y-0.5">{children}</ul>,
              li: ({ children }) => <li>{children}</li>,
              table: ({ children }) => (
                <div className="overflow-x-auto mt-1">
                  <table className="text-xs border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border px-1.5 py-1 bg-gray-50 text-left">{children}</th>,
              td: ({ children }) => <td className="border px-1.5 py-1">{children}</td>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Bot size={13} className="text-blue-600" />
      </div>
      <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
