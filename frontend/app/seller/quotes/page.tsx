"use client";

import type { QuoteResponse } from "@/lib/api-types";

import { useState } from "react";
import { useStaffData, apiRequest, refreshStaffData } from "@/hooks/use-staff-data";
import { formatVND } from "@/lib/format";
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, Car, ExternalLink, Send, ClipboardCheck, X } from "lucide-react";

export interface QuoteRecord {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  model: string;
  version: string;
  color: string;
  province: string;
  finalPrice: number;
  priceVersion: string;
  status: "pending" | "approved" | "rejected" | "expired";
  sellerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  priceSnapshot?: Record<string, unknown>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  expired: { label: "Hết hạn", color: "bg-slate-100 text-slate-600", icon: <Clock size={13} /> },
  pending:  { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700", icon: <Clock size={13} /> },
  approved: { label: "Đã duyệt",  color: "bg-green-100 text-green-700",   icon: <CheckCircle size={13} /> },
  rejected: { label: "Từ chối",   color: "bg-red-100 text-red-600",       icon: <XCircle size={13} /> },
};

export default function QuotesPage() {
  const query = useStaffData<{ quotes: QuoteResponse[] }>('seller-quotes', '/api/quotes');
  const quotes: QuoteRecord[] = (query.data?.quotes ?? []).map((q) => ({
    id: q.id, leadId: q.lead_id ?? '', leadName: q.buyer_name ?? 'Khách hàng', phone: q.buyer_phone ?? '', model: q.model,
    version: q.version, color: q.color, province: q.province, finalPrice: Number(q.final_price),
    priceVersion: q.price_version, status: q.status as QuoteRecord['status'], sellerNote: q.seller_note,
    createdAt: new Date(q.created_at + (q.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('vi-VN'),
    reviewedAt: q.reviewed_at ? new Date(q.reviewed_at + (q.reviewed_at.endsWith('Z') ? '' : 'Z')).toLocaleString('vi-VN') : null,
    priceSnapshot: q.price_snapshot,
  }));
  const loading = query.isPending;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = quotes.find((q) => q.id === selectedId) ?? null;
  const setSelected = (quote: QuoteRecord | null) => setSelectedId(quote?.id ?? null);
  const [note, setNote] = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [batchDialog, setBatchDialog] = useState<{ ready: { id: string; buyer_name: string; model: string; version: string; final_price: number }[]; blocked: { id: string; buyer_name?: string | null; model?: string | null; reason: string }[] } | null>(null);
  const [sentCampaignId, setSentCampaignId] = useState('');
  const [linkRecipient, setLinkRecipient] = useState(false);
  const [recipientNotice, setRecipientNotice] = useState('');
  const handleReview = async (id: string, action: 'reject') => {
    if (submitting) return;
    setSubmitting(true); setActionError('');
    try {
      await apiRequest('/api/quote/approve?quote_id=' + encodeURIComponent(id), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, seller_note: note }),
      });
      await refreshStaffData();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không xử lý được báo giá.'); }
    finally { setSubmitting(false); }
  };

  const selectedReviewed = reviewedIds.filter((id) => quotes.some((q) => q.id === id && q.status === 'pending'));
  const inspectBatch = async () => {
    if (!selectedReviewed.length || submitting) return;
    setSubmitting(true); setActionError(''); setSentCampaignId('');
    try {
      const result = await apiRequest<NonNullable<typeof batchDialog>>('/api/zalo/quote-review/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_ids: selectedReviewed }),
      });
      setBatchDialog(result);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không kiểm tra được điều kiện gửi Zalo.'); }
    finally { setSubmitting(false); }
  };
  const approveAndSend = async () => {
    if (!batchDialog?.ready.length || submitting) return;
    setSubmitting(true); setActionError('');
    try {
      const result = await apiRequest<{ campaign_id: string; approved: number }>('/api/zalo/quote-review/approve-and-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_ids: batchDialog.ready.map((q) => q.id) }),
      });
      setSentCampaignId(result.campaign_id); setReviewedIds((ids) => ids.filter((id) => !batchDialog.ready.some((q) => q.id === id)));
      setBatchDialog(null); await refreshStaffData();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể duyệt và gửi báo giá.'); }
    finally { setSubmitting(false); }
  };

  const pending = quotes.filter((q) => q.status === "pending").length;
  const approved = quotes.filter((q) => q.status === "approved").length;
  const filtered = quotes.filter((q) => filterStatus === "all" || q.status === filterStatus);

  return (
    <div className="flex h-full">
      {(query.error || actionError) && <p role="alert" className="absolute z-20 rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError || query.error?.message}</p>}
      {/* ── LEFT: List ── */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Báo giá (Quotes)</h1>
            <p className="text-slate-500 text-sm mt-1">Duyệt và quản lý báo giá từ khách hàng</p>
          </div>
          <div className="flex gap-2">
            <button onClick={inspectBatch} disabled={!selectedReviewed.length || submitting} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">
              <Send size={14} /> Duyệt & gửi Zalo ({selectedReviewed.length})
            </button>
            <button onClick={() => query.refetch()} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới
            </button>
          </div>
        </div>
        {sentCampaignId && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Đã duyệt và đưa báo giá vào hàng đợi gửi Zalo. <a className="font-semibold underline" href="/seller/zalo">Theo dõi trạng thái gửi</a></div>}
        {recipientNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{recipientNotice}</div>}

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
                      {reviewedIds.includes(q.id) && q.status === 'pending' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Đã kiểm tra</span>}
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

            <div className="flex gap-2">
              <button onClick={() => setPreviewOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-600 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 font-medium text-xs">
                <Eye size={15} /> Xem trước báo giá
              </button>
              <a href={`/api/quotes/${selected.id}/pdf`} target="_blank" rel="noopener noreferrer" className="px-3 flex items-center justify-center rounded-xl border text-slate-600" aria-label="Mở PDF"><ExternalLink size={15} /></a>
            </div>
            {/* Note */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ghi chú của tư vấn viên</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={selected.status !== "pending"}
                placeholder="Nhập lý do từ chối hoặc ghi chú nội bộ..."
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
                  {STATUS_CONFIG[selected.status].label}
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
                onClick={() => setLinkRecipient(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 font-medium text-sm"
              >
                <Send size={15} /> Liên kết người nhận Zalo
              </button>
              <button
                disabled={submitting}
                onClick={() => setReviewedIds((ids) => ids.includes(selected.id) ? ids.filter((id) => id !== selected.id) : [...ids, selected.id])}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${reviewedIds.includes(selected.id) ? 'border border-blue-300 bg-blue-50 text-blue-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                <ClipboardCheck size={16} /> {reviewedIds.includes(selected.id) ? 'Bỏ đánh dấu đã kiểm tra' : 'Đánh dấu đã kiểm tra'}
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
      {batchDialog && <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="batch-title">
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6 space-y-4">
          <div><h2 id="batch-title" className="text-lg font-bold text-slate-900">Kiểm tra lượt duyệt và gửi Zalo</h2><p className="mt-1 text-sm text-slate-500">Báo giá đủ điều kiện sẽ được duyệt và gửi kèm PDF tới khách qua tài khoản Zalo đã liên kết.</p></div>
          {!batchDialog.ready.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Chưa có báo giá nào đủ điều kiện gửi. Các báo giá vẫn giữ trạng thái chờ duyệt.</p>}
          {!!batchDialog.ready.length && <div><p className="font-semibold text-sm text-emerald-800 mb-2">Sẵn sàng ({batchDialog.ready.length})</p><div className="max-h-40 overflow-y-auto divide-y rounded-xl border">{batchDialog.ready.map((q) => <div key={q.id} className="flex justify-between gap-3 p-3 text-sm"><span>{q.buyer_name} · {q.model} {q.version}</span><b>{formatVND(Number(q.final_price))}</b></div>)}</div></div>}
          {!!batchDialog.blocked.length && <div><p className="font-semibold text-sm text-amber-800 mb-2">Cần xử lý ({batchDialog.blocked.length})</p><div className="max-h-40 overflow-y-auto divide-y rounded-xl border">{batchDialog.blocked.map((q) => <div key={q.id} className="p-3 text-sm"><p className="font-medium">{q.buyer_name || `Báo giá ${q.id.slice(0, 8)}`}{q.model ? ` · ${q.model}` : ''}</p><p className="text-amber-800">{q.reason}</p></div>)}</div><a href="/seller/zalo" className="inline-block mt-2 text-sm text-blue-700 underline">Mở quản lý kết nối và người nhận Zalo</a></div>}
          <div className="flex justify-end gap-2 border-t pt-4"><button onClick={() => setBatchDialog(null)} className="px-4 py-2 rounded-lg border text-sm">Đóng</button><button disabled={!batchDialog.ready.length || submitting} onClick={approveAndSend} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">{submitting ? 'Đang xử lý…' : `Duyệt & gửi ${batchDialog.ready.length} báo giá`}</button></div>
        </div>
      </div>}
      {previewOpen && selected && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="quote-preview-title">
        <section className="flex h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[94vh]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0"><h2 id="quote-preview-title" className="truncate font-semibold text-slate-900">Xem trước báo giá · {selected.leadName}</h2><p className="mt-0.5 text-xs text-slate-500">{selected.model} {selected.version} · {formatVND(selected.finalPrice)}</p></div>
            <div className="flex shrink-0 items-center gap-2"><a href={`/api/quotes/${selected.id}/pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ExternalLink size={15} /><span className="hidden sm:inline">Mở riêng</span></a><button onClick={() => setPreviewOpen(false)} aria-label="Đóng xem trước" className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"><X size={18} /></button></div>
          </header>
          <iframe title="PDF báo giá" src={`/api/quotes/${selected.id}/preview-pdf`} className="min-h-0 flex-1 bg-slate-100" />
        </section>
      </div>}
      {linkRecipient && selected?.status === 'pending' && <RecipientLink quote={selected} onClose={() => setLinkRecipient(false)} onSaved={() => { setLinkRecipient(false); setRecipientNotice('Người nhận Zalo đã được liên kết. Bạn có thể tiếp tục đánh dấu và duyệt báo giá.'); }} />}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label}</span>;
}

function RecipientLink({ quote, onClose, onSaved }: { quote: QuoteRecord; onClose: () => void; onSaved: () => void }) {
  const friends = useStaffData<{ friends: { uid: string; name: string }[] }>('quote-review-zalo-friends', '/api/zalo/friends', 0);
  const [uid, setUid] = useState('');
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!quote.leadId || !uid || !consent || !note.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/api/zalo/contacts/${quote.leadId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zalo_uid: uid, consent: true, consent_note: note.trim(), opted_out: false }),
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được người nhận Zalo.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="recipient-link-title">
    <section className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <div><h2 id="recipient-link-title" className="font-semibold text-slate-900">Liên kết người nhận Zalo</h2><p className="mt-1 text-sm text-slate-500">{quote.leadName} · {quote.phone || 'Chưa có số điện thoại'}</p></div>
      <label className="block space-y-2 text-sm font-medium">Chọn khách trong danh bạ Zalo<select className="w-full rounded-xl border border-slate-200 px-3 py-2.5" value={uid} onChange={(e) => setUid(e.target.value)}><option value="">Chọn người nhận</option>{friends.data?.friends.map((f) => <option key={f.uid} value={f.uid}>{f.name}</option>)}</select></label>
      {friends.isPending && <p className="text-xs text-slate-500">Đang tải danh bạ Zalo…</p>}
      {friends.error && <p className="text-sm text-red-700">{friends.error.message}</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-emerald-700" />Khách hàng đã đồng ý nhận báo giá qua Zalo.</label>
      <label className="block space-y-2 text-sm font-medium">Ghi nhận sự đồng ý<textarea className="w-full rounded-xl border border-slate-200 px-3 py-2" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Khách đồng ý nhận báo giá khi tư vấn ngày…" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><button disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Đóng</button><button disabled={busy || !uid || !consent || !note.trim()} onClick={save} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu người nhận'}</button></div>
    </section>
  </div>;
}
