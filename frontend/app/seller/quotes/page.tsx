"use client";

import { useState } from "react";
import { QUOTES, QuoteItem } from "@/lib/seller-mock-data";
import { formatVND } from "@/lib/format";
import { CheckCircle, XCircle, FileText, Clock, Eye, Check } from "lucide-react";

const STATUS_CONFIG = {
  pending:  { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={13} /> },
  approved: { label: "Đã duyệt",  color: "bg-green-100 text-green-700",   icon: <CheckCircle size={13} /> },
  rejected: { label: "Từ chối",   color: "bg-red-100 text-red-600",       icon: <XCircle size={13} /> },
};

export default function QuotesPage() {
  const [quotes, setQuotes]   = useState<QuoteItem[]>(QUOTES);
  const [selected, setSelected] = useState<QuoteItem | null>(null);
  const [note, setNote]         = useState("");
  const [filterStatus, setFilter] = useState("all");

  const pending  = quotes.filter((q) => q.status === "pending").length;
  const approved = quotes.filter((q) => q.status === "approved").length;

  const handleReview = (id: string, action: "approved" | "rejected") => {
    setQuotes((p) =>
      p.map((q) =>
        q.id === id
          ? { ...q, status: action, reviewedAt: new Date().toISOString(), sellerNote: note || null }
          : q
      )
    );
    setSelected(null);
    setNote("");
  };

  const filtered = quotes.filter((q) => filterStatus === "all" || q.status === filterStatus);

  return (
    <div className="flex h-full">
      {/* ── LEFT: List ── */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo giá</h1>
          <p className="text-slate-500 text-sm mt-1">Duyệt và quản lý báo giá từ AI</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-xs text-yellow-600 font-medium">Chờ duyệt</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{pending}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-xs text-green-600 font-medium">Đã duyệt</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{approved}</p>
          </div>
          <div className="bg-white border rounded-3xl p-4 text-center shadow-sm">
            <p className="text-xs text-slate-500">Tổng</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{quotes.length}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((s) => {
            const count = s === "all" ? quotes.length : quotes.filter((q) => q.status === s).length;
            const labels: Record<string, string> = { all: "Tất cả", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" };
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s ? "bg-blue-600 text-white" : "bg-white border text-slate-600 hover:border-blue-300"
                }`}
              >
                {labels[s]} ({count})
              </button>
            );
          })}
        </div>

        {/* Quote cards */}
        <div className="space-y-3">
          {filtered.map((q) => (
            <button
              key={q.id}
              onClick={() => { setSelected(q); setNote(q.sellerNote || ""); }}
              className={`w-full text-left bg-white rounded-2xl border p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all ${selected?.id === q.id ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="font-semibold text-slate-900">{q.leadName}</p>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[q.status].color}`}>
                      {STATUS_CONFIG[q.status].icon}
                      {STATUS_CONFIG[q.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 font-medium">
                    {q.model} {q.version} · {q.province}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {q.leadPhone} · Bảng giá {q.priceVersion}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900">{formatVND(q.finalPrice)}</p>
                  <p className="text-xs text-slate-400 mt-1">{q.createdAt}</p>
                </div>
              </div>

              {/* Config summary */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag label={q.config.color} />
                <Tag label={q.config.battery} />
                {q.config.accessories.map((a) => <Tag key={a} label={a} />)}
                {q.config.promos.map((p) => <Tag key={p} label={p} green />)}
              </div>

              {q.sellerNote && (
                <p className="mt-2 text-xs text-slate-500 italic">Ghi chú: {q.sellerNote}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Review panel ── */}
      {selected ? (
        <div className="w-80 border-l bg-white flex-shrink-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-5 border-b bg-slate-50">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Duyệt báo giá
            </p>
            <p className="font-bold text-slate-900">{selected.leadName}</p>
            <p className="text-sm text-blue-600">{selected.model} {selected.version}</p>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
            {/* Price breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chi tiết cấu hình</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between"><span>Phiên bản</span><span className="font-medium">{selected.version}</span></div>
                <div className="flex justify-between"><span>Màu sắc</span><span className="font-medium">{selected.config.color}</span></div>
                <div className="flex justify-between"><span>Pin</span><span className="font-medium">{selected.config.battery}</span></div>
                {selected.config.accessories.map((a) => (
                  <div key={a} className="flex justify-between items-center"><span>{a}</span><Check size={13} className="text-slate-400" /></div>
                ))}
              </div>
            </div>

            {/* Promos */}
            {selected.config.promos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ưu đãi áp dụng</p>
                {selected.config.promos.map((p) => (
                  <div key={p} className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg">{p}</div>
                ))}
              </div>
            )}

            {/* Final price */}
            <div className="bg-blue-600 text-white rounded-xl p-4 text-center">
              <p className="text-xs text-blue-200">Giá lăn bánh</p>
              <p className="text-2xl font-bold mt-1">{formatVND(selected.finalPrice)}</p>
              <p className="text-xs text-blue-300 mt-1">Bảng giá {selected.priceVersion}</p>
            </div>

            {/* Note */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ghi chú</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={selected.status !== "pending"}
                placeholder="Thêm ghi chú cho khách hàng..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            {/* Reviewed info */}
            {selected.status !== "pending" && (
              <div className={`rounded-xl p-3 text-xs ${selected.status === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                <p className="font-semibold mb-1">
                  {selected.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                </p>
                <p>{selected.reviewedAt}</p>
                {selected.sellerNote && <p className="mt-1">Ghi chú: {selected.sellerNote}</p>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {selected.status === "pending" && (
            <div className="px-5 py-4 border-t space-y-2">
              <button
                onClick={() => handleReview(selected.id, "approved")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
              >
                <CheckCircle size={16} /> Duyệt & Gửi PDF cho khách
              </button>
              <button
                onClick={() => handleReview(selected.id, "rejected")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 font-medium text-sm transition-colors"
              >
                <XCircle size={16} /> Từ chối
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-colors">
                <FileText size={14} /> Xem trước PDF
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-80 border-l bg-slate-50 flex-shrink-0 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Eye size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Chọn báo giá để xem & duyệt</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label, green }: { label: string; green?: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${green ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}
