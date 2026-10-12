"use client";

import { useState, useEffect } from "react";
import { formatVND } from "@/lib/format";
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, Car, FileDown } from "lucide-react";

export interface QuoteRecord {
  id: string;
  leadName: string;
  phone: string;
  model: string;
  version: string;
  color: string;
  province: string;
  finalPrice: number;
  priceVersion: string;
  status: "pending" | "approved" | "rejected";
  sellerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  priceSnapshot?: any;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  pending:  { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={13} /> },
  approved: { label: "Đã duyệt",  color: "bg-green-100 text-green-700",   icon: <CheckCircle size={13} /> },
  rejected: { label: "Từ chối",   color: "bg-red-100 text-red-600",       icon: <XCircle size={13} /> },
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuoteRecord | null>(null);
  const [note, setNote] = useState("");
  const [filterStatus, setFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes");
      if (res.ok) {
        const data = await res.json();
        const mapped: QuoteRecord[] = (data.quotes || []).map((q: any) => ({
          id: q.id,
          leadName: q.buyer_name || "Khách hàng",
          phone: q.buyer_phone || "Chưa có SĐT",
          model: q.model || "VF",
          version: q.version || "Plus",
          color: q.color || "Trắng",
          province: q.province || "Hà Nội",
          finalPrice: Number(q.final_price) || 0,
          priceVersion: q.price_version || "2025-Q4-v1",
          status: (q.status in STATUS_CONFIG ? q.status : "pending") as QuoteRecord["status"],
          sellerNote: q.seller_note || null,
          createdAt: q.created_at ? new Date(q.created_at).toLocaleDateString("vi-VN") : "Hôm nay",
          reviewedAt: q.reviewed_at ? new Date(q.reviewed_at).toLocaleDateString("vi-VN") : null,
          priceSnapshot: q.price_snapshot,
        }));
        setQuotes(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quote/approve?quote_id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, seller_note: note }),
      });
      if (res.ok) {
        const nextStatus = action === "approve" ? "approved" : "rejected";
        setQuotes((prev) =>
          prev.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status: nextStatus,
                  reviewedAt: new Date().toLocaleDateString("vi-VN"),
                  sellerNote: note || null,
                }
              : q
          )
        );
        if (selected?.id === id) {
          setSelected((prev) =>
            prev
              ? {
                  ...prev,
                  status: nextStatus,
                  reviewedAt: new Date().toLocaleDateString("vi-VN"),
                  sellerNote: note || null,
                }
              : null
          );
        }
      } else {
        alert("Thao tác duyệt báo giá thất bại.");
      }
    } catch (err) {
      console.error("Failed to approve/reject quote:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = quotes.filter((q) => q.status === "pending").length;
  const approved = quotes.filter((q) => q.status === "approved").length;
  const filtered = quotes.filter((q) => filterStatus === "all" || q.status === filterStatus);

  return (
    <div className="flex h-full">
      {/* ── LEFT: List ── */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Báo giá (Quotes)</h1>
            <p className="text-slate-500 text-sm mt-1">Duyệt và quản lý báo giá từ khách hàng</p>
          </div>
          <button
            onClick={fetchQuotes}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
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
          <div className="bg-white border rounded-2xl p-4 text-center shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Tổng báo giá</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{quotes.length}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((s) => {
            const count = s === "all" ? quotes.length : quotes.filter((q) => q.status === s).length;
            const labels: Record<string, string> = {
              all: "Tất cả",
              pending: "Chờ duyệt",
              approved: "Đã duyệt",
              rejected: "Từ chối",
            };
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border text-slate-600 hover:border-blue-300"
                }`}
              >
                {labels[s]} ({count})
              </button>
            );
          })}
        </div>

        {/* Quote cards */}
        {loading && quotes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải báo giá từ database...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Không tìm thấy báo giá nào</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <button
                key={q.id}
                onClick={() => {
                  setSelected(q);
                  setNote(q.sellerNote || "");
                }}
                className={`w-full text-left bg-white rounded-2xl border p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all ${
                  selected?.id === q.id ? "border-blue-500 ring-1 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="font-semibold text-slate-900">{q.leadName}</p>
                      <span
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[q.status]?.color}`}
                      >
                        {STATUS_CONFIG[q.status]?.icon}
                        {STATUS_CONFIG[q.status]?.label ?? q.status}
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 font-medium">
                      {q.model} {q.version} · {q.color} · {q.province}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">SĐT: {q.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatVND(q.finalPrice)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Tạo: {q.createdAt}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Detail ── */}
      {selected ? (
        <div className="w-88 border-l bg-white flex-shrink-0 flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">{selected.leadName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">SĐT: {selected.phone}</p>
              </div>
              <span
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[selected.status]?.color}`}
              >
                {STATUS_CONFIG[selected.status]?.icon}
                {STATUS_CONFIG[selected.status]?.label ?? selected.status}
              </span>
            </div>

            {/* Car config */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Car size={14} className="text-blue-600" />
                <span>
                  VinFast {selected.model} {selected.version}
                </span>
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <Tag label={`Màu: ${selected.color}`} />
                <Tag label={`Tỉnh/thành: ${selected.province}`} />
              </div>
            </div>

            {/* Final price */}
            <div className="bg-blue-600 text-white rounded-xl p-4 text-center">
              <p className="text-xs text-blue-200">Giá lăn bánh dự tính</p>
              <p className="text-2xl font-bold mt-1">{formatVND(selected.finalPrice)}</p>
              <p className="text-xs text-blue-200 mt-1">Phiên bản bảng giá: {selected.priceVersion}</p>
            </div>

            {/* Official PDF Download Button */}
            <a
              href={`/api/quotes/${selected.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              download={`VinFast_BaoGia_${selected.id.slice(0, 8).toUpperCase()}.pdf`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-600 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 font-medium text-xs transition-colors shadow-sm"
            >
              <FileDown size={15} />
              <span>Tải bản in Báo giá PDF chính thức</span>
            </a>


            {/* Note */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ghi chú của tư vấn viên</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={selected.status !== "pending"}
                placeholder="Nhập ghi chú hoặc lý do phê duyệt/từ chối..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            {/* Reviewed info */}
            {selected.status !== "pending" && (
              <div
                className={`rounded-xl p-3 text-xs ${
                  selected.status === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                <p className="font-semibold mb-1">
                  {selected.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                </p>
                <p>Ngày xử lý: {selected.reviewedAt || "Đã lưu"}</p>
                {selected.sellerNote && <p className="mt-1">Ghi chú: {selected.sellerNote}</p>}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {selected.status === "pending" && (
            <div className="p-4 border-t bg-slate-50 space-y-2">
              <button
                disabled={submitting}
                onClick={() => handleReview(selected.id, "approve")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium text-sm transition-colors shadow-sm"
              >
                <CheckCircle size={16} /> Duyệt báo giá
              </button>
              <button
                disabled={submitting}
                onClick={() => handleReview(selected.id, "reject")}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 font-medium text-sm transition-colors"
              >
                <XCircle size={16} /> Từ chối
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-88 border-l bg-slate-50 flex-shrink-0 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Eye size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Chọn báo giá để xem chi tiết & phê duyệt</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label}</span>;
}
