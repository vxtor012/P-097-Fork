"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BRAND } from "@/lib/brand";
import { useChat } from "@/hooks/use-chat";

export function FloatingChat() {
    const pathname = usePathname();
    const { messages, sendWithContext, isLoading } = useChat();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, open]);

    if (
        pathname === "/login" ||
        pathname.startsWith("/seller") ||
        pathname.startsWith("/warehouse")
    ) {
        return null;
    }

    const submit = () => {
        const message = input.trim();
        if (!message || isLoading) return;

        sendWithContext(message);
        setInput("");
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100] sm:bottom-6 sm:right-6">
            {open && (
                <section
                    role="dialog"
                    aria-label={`Chat với trợ lý ${BRAND.name}`}
                    className="absolute bottom-[calc(100%+12px)] right-0 flex h-[min(68dvh,560px)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#172a27]/10 bg-[#fdfcf8] shadow-2xl"
                >
                    <header className="flex items-center gap-3 border-b border-[#172a27]/10 bg-white px-4 py-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#134c40] text-white">
                            <Bot size={20} />
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                Trợ lý {BRAND.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                Hỏi về xe, giá và đại lý
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Đóng khung chat"
                            className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-[#eff4ed]"
                        >
                            <X size={18} />
                        </button>
                    </header>

                    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
                        {messages.length === 0 ? (
                            <div className="rounded-xl border border-[#134c40]/10 bg-white p-4 text-sm leading-6 text-slate-600">
                                Xin chào! Bạn có thể hỏi mình về các dòng xe, chi phí dự kiến,
                                trả góp hoặc đại lý.
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    <div
                                        className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user"
                                            ? "rounded-br-sm bg-[#134c40] text-white"
                                            : "rounded-bl-sm border border-[#172a27]/10 bg-white text-slate-800"
                                            }`}
                                    >
                                        {message.role === "user" ? (
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        ) : (
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {isLoading && (
                            <p role="status" className="text-xs text-slate-500">
                                Trợ lý đang trả lời…
                            </p>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    <form
                        className="flex items-end gap-2 border-t border-[#172a27]/10 bg-white p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit();
                        }}
                    >
                        <textarea
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    submit();
                                }
                            }}
                            rows={1}
                            disabled={isLoading}
                            aria-label="Nhập câu hỏi"
                            placeholder="Nhập câu hỏi..."
                            className="max-h-28 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#458e73] focus:ring-2 focus:ring-[#458e73]/20"
                        />

                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            aria-label="Gửi câu hỏi"
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#134c40] text-white transition hover:bg-[#1f6352] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </section>
            )}

            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={open ? "Đóng chat" : "Mở chat với trợ lý"}
                title={open ? "Đóng chat" : "Hỏi trợ lý"}
                className={`relative grid h-[62px] w-[62px] place-items-center rounded-full text-white shadow-xl transition duration-200 hover:scale-105 ${open
                    ? "bg-[#134c40] hover:bg-[#1f6352]"
                    : "bg-gradient-to-br from-amber-300 via-orange-500 to-rose-500 shadow-orange-500/40"
                    }`}
            >
                {open ? (
                    <X size={25} />
                ) : (
                    <>
                        <span className="absolute inset-[-5px] rounded-full border-2 border-orange-300/70 animate-ping" />

                        <svg
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                            className="relative h-10 w-10 drop-shadow-sm"
                            fill="none"
                        >
                            <path
                                d="M24 10V6"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            <circle cx="24" cy="5" r="3" fill="#FFF7C2" />

                            <rect x="9" y="13" width="30" height="25" rx="10" fill="white" />
                            <path
                                d="M6 22v7M42 22v7"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />

                            <circle cx="18" cy="24" r="2.5" fill="#134c40" />
                            <circle cx="30" cy="24" r="2.5" fill="#134c40" />
                            <path
                                d="M19 31c1.3 1.5 3 2.2 5 2.2s3.7-.7 5-2.2"
                                stroke="#134c40"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />

                            <circle cx="13.5" cy="29" r="2" fill="#FFB2A1" />
                            <circle cx="34.5" cy="29" r="2" fill="#FFB2A1" />
                        </svg>

                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-400" />
                    </>
                )}
            </button>
        </div>
    );
}