"use client";

import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { PriceCard } from "./price-card";
import { InstallmentCard } from "./installment-card";
import { InventoryCard } from "./inventory-card";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mb-1",
          isUser ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600"
        )}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-2 max-w-[78%]", isUser && "items-end")}>
        {/* Text bubble */}
        {message.content && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
              isUser
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border text-gray-800 rounded-bl-sm"
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 mt-1">{children}</ul>,
                li: ({ children }) => <li>{children}</li>,
                table: ({ children }) => (
                  <div className="overflow-x-auto mt-2">
                    <table className="text-xs border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border px-2 py-1 bg-gray-50 font-medium text-left">{children}</th>
                ),
                td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Structured data cards */}
        {message.data?.type === "price_quote" && (
          <PriceCard data={message.data} />
        )}
        {message.data?.type === "installment" && (
          <InstallmentCard data={message.data} />
        )}
        {message.data?.type === "inventory" && (
          <InventoryCard data={message.data} />
        )}

        {/* Timestamp */}
        <span className="text-xs text-gray-400 px-1">
          {new Date(message.timestamp).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
