"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, MessageCircle, QrCode, Search, Send, Users, Wifi, X } from "lucide-react";
import { apiRequest, useStaffData } from "@/hooks/use-staff-data";
import { useAuthStore } from "@/lib/auth-store";
import { formatVND } from "@/lib/format";

type Connection = { status: string; uid: string | null; qr: string | null };
type Quote = { id: string; lead_id: string; buyer_name: string; phone: string; model: string; version: string; final_price: number; zalo_uid: string | null; account_uid: string | null; consent: boolean; consent_note: string | null; opted_out: boolean | null };
type Campaign = { attach_pdf: boolean; id: string; name: string; status: string; total: number; sent: number; attention: number; created_at: string };
type Delivery = { pdf_name: string | null; id: string; name: string; message: string; status: string; error: string | null };
type Friend = { uid: string; name: string };
const labels: Record<string, string> = { disconnected: "Chưa kết nối", connecting: "Đang tạo mã QR", waiting: "Chờ quét QR", scanned: "Xác nhận đăng nhập trên điện thoại", connected: "Đã kết nối", expired: "Mã QR đã hết hạn", reconnect_required: "Cần kết nối lại", account_in_use: "Tài khoản đang được nhân viên khác sử dụng", restoring: "Đang khôi phục kết nối", draft: "Bản nháp", active: "Đang gửi", paused: "Tạm dừng", done: "Hoàn tất", cancelled: "Đã hủy", pending: "Chờ gửi", sending: "Đang xử lý", sent: "Đã gửi", failed: "Gửi thất bại", unknown: "Cần đối soát", skipped: "Đã bỏ qua" };
const buttonBase = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
const button = `${buttonBase} border-slate-200 bg-white hover:bg-slate-50`;
const primary = `${buttonBase} border-transparent bg-[#134c40] text-white hover:bg-[#1f6352]`;
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const post = (body?: object): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
const errorText = (e: unknown) => e instanceof Error ? e.message : "Không thể hoàn thành thao tác. Vui lòng thử lại.";

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${["connected", "sent", "done"].includes(status) ? "bg-emerald-50 text-emerald-700" : ["failed", "unknown", "reconnect_required"].includes(status) ? "bg-amber-50 text-amber-800" : status === "active" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{labels[status] ?? status}</span>;
}

export default function ZaloPage() {
  const user = useAuthStore(s => s.user);
  const [dealer, setDealer] = useState("");
  const dealers = useStaffData<{ dealers: { id: string; name: string }[] }>("zalo-dealers", "/api/dealers");
  const id = user?.role === "admin" ? dealer : user?.dealerId;
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Chăm sóc khách hàng</p><h1 className="text-2xl font-bold text-slate-900">Gửi báo giá qua Zalo</h1><p className="mt-2 text-sm text-slate-500">Kết nối Zalo cá nhân của bạn để gửi báo giá và theo dõi khách hàng được phân công.</p></div>
      {user?.role === "admin" && <label className="w-64 text-sm text-slate-600">Lọc báo giá theo đại lý<select className={input} value={dealer} onChange={e => setDealer(e.target.value)}><option value="">Tất cả đại lý</option>{dealers.data?.dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
    </header>
    {dealers.error && user?.role === "admin" && <p role="alert" className="text-sm text-red-700">{dealers.error.message}</p>}
    {user && <Workspace key={`${user.id}:${id ?? ""}`} dealer={id ?? ""} />}
  </div>;
}

function Workspace({ dealer }: { dealer: string }) {
  const suffix = dealer ? `?dealer_id=${encodeURIComponent(dealer)}` : "";
  const connection = useStaffData<Connection>("zalo-connection", "/api/zalo/connection", 2000);
  const candidates = useStaffData<{ quotes: Quote[]; template: string }>("zalo-candidates", `/api/zalo/candidates${suffix}`);
  const campaigns = useStaffData<{ campaigns: Campaign[] }>("zalo-campaigns", `/api/zalo/campaigns${suffix}`, 5000);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [attachPdf, setAttachPdf] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Quote | null>(null);
  const [detailId, setDetailId] = useState("");
  const [tab, setTab] = useState("create");
  const [confirmReconnect, setConfirmReconnect] = useState(false);
  const request = useRef<{ id: string; fingerprint: string } | null>(null);
  const account = connection.data;
  const connected = account?.status === "connected";
  const quotes = candidates.data?.quotes ?? [];
  const rows = campaigns.data?.campaigns ?? [];
  const eligible = (q: Quote) => q.consent && !!q.zalo_uid && q.account_uid === account?.uid;
  const filtered = quotes.filter(q => (!model || q.model === model) && `${q.buyer_name} ${q.phone} ${q.model}`.toLowerCase().includes(search.toLowerCase()));
  const selectableCount = Math.min(200, new Set(filtered.filter(q => !q.opted_out).map(q => q.lead_id)).size);
  const chosen = quotes.filter(q => selected.includes(q.id));
  const selectedValid = chosen.length === selected.length && chosen.every(eligible);
  const incomplete = chosen.filter(q => !eligible(q));
  const preview = chosen[0];
  const message = (template ?? candidates.data?.template ?? "").replace(/\{(name|model|version|price)\}/g, (_, key: string) => preview ? ({ name: preview.buyer_name || "anh/chị", model: preview.model, version: preview.version, price: Number(preview.final_price).toLocaleString("vi-VN") } as Record<string, string>)[key] : `{${key}}`);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function createQr() {
    await perform(async () => {
      if (account && account.status !== "disconnected") {
        const result = await apiRequest<Connection>("/api/zalo/connection", { method: "DELETE" });
        if (result.status === "busy") {
          setNotice("Một tin đang được gửi. Vui lòng chờ hoàn tất rồi tạo mã QR mới.");
          return;
        }
      }
      setConfirmReconnect(false);
      await apiRequest("/api/zalo/connection", post());
      await connection.refetch();
    });
  }
  function selectVisible() {
    const unique = new Map<string, string>();
    for (const q of filtered) if (!q.opted_out && !unique.has(q.lead_id) && unique.size < 200) unique.set(q.lead_id, q.id);
    setSelected([...unique.values()]);
  }
  async function createDraft() {
    const payload = { name: name.trim(), template: template ?? candidates.data?.template, quote_ids: selected, attach_pdf: attachPdf };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { id: crypto.randomUUID(), fingerprint };
    const result = await apiRequest<{ id: string }>(`/api/zalo/campaigns${suffix}`, post({ ...payload, id: request.current.id }));
    request.current = null; setSelected([]); setDetailId(result.id); setTab("history"); await campaigns.refetch();
    setNotice("Đã lưu chiến dịch. Xem lại nội dung từng khách rồi xác nhận gửi.");
  }
  const readiness = (q: Quote) => q.opted_out ? "Đã ngừng nhận tin" : !q.zalo_uid ? "Chưa chọn người nhận" : q.account_uid !== account?.uid ? "Cần liên kết với tài khoản hiện tại" : !q.consent ? "Chưa xác nhận quyền nhận tin" : "Sẵn sàng gửi";

  return <>
    {(error || connection.error || candidates.error || campaigns.error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || connection.error?.message || candidates.error?.message || campaigns.error?.message}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <section id="zalo-connection" className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className={`rounded-xl p-3 ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Wifi size={22} /></span><div><h2 className="font-semibold text-slate-900">Zalo cá nhân của bạn</h2><div className="mt-1"><Badge status={account?.status ?? "restoring"} /></div></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy} onClick={() => connected ? setConfirmReconnect(true) : createQr()}><QrCode size={18} />{busy ? "Đang xử lý…" : connected ? "Đăng nhập lại bằng QR" : account?.qr || ["expired", "connecting", "scanned"].includes(account?.status ?? "") ? "Tạo mã QR mới" : "Tạo mã QR"}</button>
          {account && account.status !== "disconnected" && <button className={button} disabled={busy} onClick={() => perform(async () => { const result = await apiRequest<Connection>("/api/zalo/connection", { method: "DELETE" }); if (result.status === "busy") setNotice("Một tin đang được gửi. Vui lòng chờ hoàn tất rồi ngắt kết nối."); await connection.refetch(); })}>{connected ? "Ngắt kết nối" : "Hủy kết nối"}</button>}</div>
      </div>
      {confirmReconnect && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-900">Zalo đang được kết nối. Tạo mã QR mới sẽ ngắt phiên hiện tại để bạn đăng nhập lại.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy} onClick={createQr}>Tạo mã QR mới</button><button type="button" className={button} disabled={busy} onClick={() => setConfirmReconnect(false)}>Giữ kết nối hiện tại</button></div></div>}
      {account?.qr && <div className="mt-5 flex flex-wrap items-center gap-6 border-t pt-5"><Image unoptimized src={account.qr} alt="Mã QR kết nối Zalo cá nhân của bạn" width={220} height={220} className="rounded-xl border p-2" /><div className="max-w-sm"><h3 className="font-medium">Quét mã bằng Zalo của bạn</h3><p className="mt-2 text-sm leading-6 text-slate-500">Mở Zalo trên điện thoại, quét mã và xác nhận đăng nhập. Kết nối và lịch sử gửi được lưu riêng theo tài khoản nhân viên.</p></div></div>}
    </section>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
      { label: "Báo giá đã duyệt", value: quotes.length, icon: Users },
      { label: "Người nhận sẵn sàng", value: new Set(quotes.filter(eligible).map(q => q.lead_id)).size, icon: CheckCircle2 },
      { label: "Chiến dịch đang gửi", value: rows.filter(c => c.status === "active").length, icon: Send },
      { label: "Tin đã gửi", value: rows.reduce((sum, c) => sum + Number(c.sent), 0), icon: MessageCircle },
    ].map(s => <div key={s.label} className={panel}><s.icon size={18} className="mb-3 text-emerald-700" /><p className="text-2xl font-bold text-slate-900">{s.value}</p><p className="mt-1 text-xs text-slate-500">{s.label}</p></div>)}</div>
    <div className="flex gap-1 border-b border-slate-200">{[["create", "Tạo chiến dịch"], ["history", "Lịch sử gửi"]].map(([id, title]) => <button key={id} className={`border-b-2 px-5 py-3 text-sm font-semibold ${tab === id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`} onClick={() => setTab(id)}>{title}</button>)}</div>
    {tab === "create" && selected.length > 0 && (!connected || !selectedValid) && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div>{!connected ? "Đã chọn khách. Kết nối Zalo để hoàn tất người nhận và tiếp tục." : incomplete.length > 0 ? `${incomplete.length} khách đã chọn cần hoàn tất người nhận hoặc quyền nhận tin trước khi gửi.` : "Có báo giá đã thay đổi. Vui lòng chọn lại danh sách."}{connected && incomplete.length > 0 && <p className="mt-1 text-xs">{incomplete.slice(0, 3).map(q => q.buyer_name).join(", ")}{incomplete.length > 3 ? "…" : ""}</p>}</div>{!connected ? <a href="#zalo-connection" className={button}>Kết nối Zalo</a> : incomplete[0] ? <button className={button} disabled={busy} onClick={() => setEditing(incomplete[0])}>Hoàn tất người nhận</button> : <button className={button} disabled={busy} onClick={() => setSelected([])}>Chọn lại</button>}</div>}
    {tab === "create" ? <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <section className={`${panel} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">1. Chọn khách hàng</h2><span className="text-sm text-emerald-700">Đã chọn {selected.length}/200</span></div>
        <div className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Tìm khách hàng" className={`${input} pl-9`} placeholder="Tên khách hàng, số điện thoại…" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Dòng xe" className={`${input} w-32`} value={model} onChange={e => setModel(e.target.value)}><option value="">Tất cả xe</option>{[...new Set(quotes.map(q => q.model))].map(m => <option key={m}>{m}</option>)}</select></div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" className={`${button} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`} disabled={busy || !selectableCount} onClick={selectVisible}><CheckCircle2 size={16} />Chọn toàn bộ ({selectableCount})</button><button type="button" className={button} disabled={busy || !selected.length} onClick={() => setSelected([])}>Bỏ chọn toàn bộ</button></div>
        {(search || model) && <p className="text-xs text-slate-400">Chọn toàn bộ áp dụng cho danh sách theo bộ lọc hiện tại.</p>}
        <p className="text-xs leading-5 text-slate-500">Bạn có thể chọn khách trước, sau đó hoàn tất người nhận Zalo trước khi gửi.</p>
        <div className="max-h-[480px] space-y-2 overflow-y-auto">{filtered.map(q => <div key={q.id} className={`flex items-start gap-3 rounded-xl border p-3 ${selected.includes(q.id) ? "border-emerald-300 bg-emerald-50/40" : "border-slate-100"}`}><input aria-label={`Chọn báo giá ${q.model} của ${q.buyer_name}`} type="checkbox" className="mt-1 accent-emerald-700" checked={selected.includes(q.id)} disabled={busy || (!selected.includes(q.id) && (!!q.opted_out || (selected.length >= 200 && !chosen.some(x => x.lead_id === q.lead_id))))} onChange={e => setSelected(ids => e.target.checked ? [...ids.filter(id => quotes.find(x => x.id === id)?.lead_id !== q.lead_id), q.id] : ids.filter(id => id !== q.id))} /><div className="min-w-0 flex-1"><p className="font-medium text-slate-800">{q.buyer_name || "Khách hàng"}</p><p className="mt-0.5 text-xs text-slate-500">{q.phone || "Chưa có số điện thoại"}</p><p className="mt-2 text-sm">{q.model} {q.version} <span className="text-slate-400">·</span> {formatVND(Number(q.final_price))}</p><p className={`mt-1 text-xs ${eligible(q) ? "text-emerald-700" : "text-amber-700"}`}>{readiness(q)}</p></div><button className="text-xs font-semibold text-emerald-800 disabled:opacity-40" disabled={busy || (!connected && !q.zalo_uid)} onClick={() => setEditing(q)}>{selected.includes(q.id) && !eligible(q) ? "Hoàn tất người nhận" : q.zalo_uid ? "Sửa" : "Người nhận"}</button></div>)}{!filtered.length && <div className="py-14 text-center text-sm text-slate-500">{candidates.isPending ? "Đang tải báo giá…" : "Chưa có báo giá đã duyệt phù hợp. Bạn có thể quản lý báo giá tại mục Báo giá."}</div>}</div>
        <p className="text-xs leading-5 text-slate-400">Mỗi khách nhận một báo giá trong chiến dịch. Khách đã ngừng nhận tin sẽ được loại khỏi danh sách gửi.</p>
      </section>
      <section className={`${panel} space-y-4`}><h2 className="font-semibold">2. Nội dung chiến dịch</h2><label className="block space-y-2 text-sm font-medium">Tên chiến dịch<input className={input} maxLength={200} placeholder="Ví dụ: Báo giá khách quan tâm VF 7" value={name} onChange={e => setName(e.target.value)} /></label><label className="block space-y-2 text-sm font-medium">Lời nhắn<textarea className={input} rows={6} maxLength={1500} value={template ?? candidates.data?.template ?? ""} onChange={e => setTemplate(e.target.value)} /></label><p className="text-xs text-slate-500">Cá nhân hóa với {"{name}, {model}, {version}, {price}"}.</p><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" className="mt-1 accent-emerald-700" checked={attachPdf} disabled={busy} onChange={e => setAttachPdf(e.target.checked)} /><span><span className="block font-medium">Đính kèm PDF báo giá đã duyệt</span><span className="mt-1 block text-xs leading-5 text-slate-500">Mỗi khách nhận file báo giá của mình. Bạn có thể mở xem từng file ở bước tiếp theo.</span></span></label><div className="rounded-xl bg-slate-50 p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Xem trước {preview && `· ${preview.buyer_name}`}</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message || "Chọn báo giá để xem nội dung gửi cho khách."}</p></div><button className={`${primary} w-full`} disabled={busy || !connected || !name.trim() || !message.trim() || !selected.length || !selectedValid} onClick={() => perform(createDraft)}>Tiếp tục · {selected.length} người nhận</button><p className="text-center text-xs text-slate-400">Bạn sẽ xem lại và xác nhận trước khi gửi.</p></section>
    </div> : <section className={`${panel} space-y-4`}><h2 className="font-semibold">Chiến dịch của bạn</h2>{rows.map(c => <button key={c.id} className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left ${detailId === c.id ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100 hover:bg-slate-50"}`} onClick={() => setDetailId(c.id)}><div><p className="font-medium text-slate-800">{c.name}</p><p className="mt-1 text-xs text-slate-500">{new Date(c.created_at.endsWith("Z") ? c.created_at : c.created_at + "Z").toLocaleString("vi-VN")} · {c.total} người nhận{c.attach_pdf && " · Kèm PDF"}</p></div><div className="flex items-center gap-4"><p className="text-right text-sm text-slate-600">{c.sent}/{c.total} đã gửi{Number(c.attention) > 0 && <span className="block text-xs text-amber-700">{c.attention} cần kiểm tra</span>}</p><Badge status={c.status} /></div></button>)}{!rows.length && <p className="py-10 text-center text-sm text-slate-500">Chưa có chiến dịch. Tạo chiến dịch đầu tiên để chăm sóc khách hàng.</p>}{detailId && <CampaignDetail key={detailId} id={detailId} suffix={suffix} campaign={rows.find(c => c.id === detailId)} onUpdated={() => campaigns.refetch()} />}</section>}
    {editing && <ContactEditor key={editing.id} quote={editing} suffix={suffix} onClose={() => setEditing(null)} onSaved={async () => { await candidates.refetch(); setEditing(null); }} />}
  </>;
}

function ContactEditor({ quote, suffix, onClose, onSaved }: { quote: Quote; suffix: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const friends = useStaffData<{ friends: Friend[] }>("zalo-friends", "/api/zalo/friends");
  const [uid, setUid] = useState(quote.zalo_uid ?? "");
  const [phone, setPhone] = useState(quote.phone ?? "");
  const [resolved, setResolved] = useState<Friend | null>(null);
  const [consent, setConsent] = useState(!!quote.consent);
  const [out, setOut] = useState(!!quote.opted_out);
  const [note, setNote] = useState(quote.consent_note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choices = friends.data?.friends ?? [];
  async function resolve() {
    setBusy(true); setError("");
    try { const found = await apiRequest<Friend>("/api/zalo/recipients/resolve", post({ phone: phone.replace(/\s/g, "") })); setResolved(found); setUid(found.uid); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError("");
    try { await apiRequest(`/api/zalo/contacts/${quote.lead_id}${suffix}`, { ...post({ zalo_uid: uid, consent, opted_out: out, consent_note: note }), method: "PUT" }); await onSaved(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="recipient-title" className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 id="recipient-title" className="font-semibold text-slate-900">Người nhận Zalo</h2><p className="mt-1 text-sm text-slate-500">{quote.buyer_name}</p></div><button aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button></div><label className="block space-y-2 text-sm font-medium">Tìm theo số điện thoại<div className="flex gap-2"><input className={input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Số điện thoại khách hàng" /><button className={button} disabled={busy || !/^0\d{9}$/.test(phone.replace(/\s/g, ""))} onClick={resolve}>Tìm</button></div></label>{resolved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Đã tìm thấy: <strong>{resolved.name}</strong></p>}<label className="block space-y-2 text-sm font-medium">Hoặc chọn từ danh bạ<select className={input} value={uid} onChange={e => setUid(e.target.value)}><option value="">Chọn người nhận</option>{resolved && !choices.some(f => f.uid === resolved.uid) && <option value={resolved.uid}>{resolved.name}</option>}{quote.zalo_uid && !choices.some(f => f.uid === quote.zalo_uid) && resolved?.uid !== quote.zalo_uid && <option value={quote.zalo_uid}>Người nhận đã liên kết</option>}{choices.map(f => <option key={f.uid} value={f.uid}>{f.name}</option>)}</select></label><label className="flex items-start gap-3 text-sm"><input className="mt-0.5 accent-emerald-700" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Khách đồng ý nhận báo giá qua Zalo</label><label className="flex items-start gap-3 text-sm"><input className="mt-0.5" type="checkbox" checked={out} onChange={e => setOut(e.target.checked)} />Ngừng gửi tin cho khách hàng này</label><label className="block space-y-2 text-sm font-medium">Ghi nhận yêu cầu của khách<input className={input} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Khách yêu cầu nhận báo giá khi tư vấn…" /></label>{(error || friends.error) && <p role="alert" className="text-sm text-red-700">{error || friends.error?.message}</p>}<div className="flex justify-end gap-2"><button className={button} disabled={busy} onClick={onClose}>Đóng</button><button className={primary} disabled={busy || !uid || !note.trim()} onClick={save}>Lưu người nhận</button></div></section></div>;
}

function CampaignDetail({ id, suffix, campaign, onUpdated }: { id: string; suffix: string; campaign?: Campaign; onUpdated: () => Promise<unknown> }) {
  const detail = useStaffData<{ deliveries: Delivery[] }>("zalo-detail", `/api/zalo/campaigns/${id}${suffix}`, 5000);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function action(status: string) {
    setBusy(true); setError("");
    try { await apiRequest(`/api/zalo/campaigns/${id}${suffix}`, { ...post({ status }), method: "PATCH" }); setConfirm(false); setNotice(status === "active" ? "Chiến dịch đã bắt đầu. Kết quả sẽ tự cập nhật." : "Đã cập nhật chiến dịch. Tin đang xử lý có thể vẫn hoàn tất."); await onUpdated(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-4 border-t pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{campaign?.name}</h3><div className="flex gap-2">{campaign && ["draft", "paused"].includes(campaign.status) && <button className={primary} disabled={busy || !detail.data?.deliveries.length} onClick={() => setConfirm(true)}><Send size={15} />{campaign.status === "paused" ? "Tiếp tục gửi" : "Gửi chiến dịch"}</button>}{campaign?.status === "active" && <button className={button} disabled={busy} onClick={() => action("paused")}>Tạm dừng</button>}{campaign && !["done", "cancelled"].includes(campaign.status) && <button className={button} disabled={busy} onClick={() => action("cancelled")}>Hủy phần chưa gửi</button>}</div></div>{confirm && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-900">Gửi báo giá{campaign?.attach_pdf ? " kèm file PDF riêng của từng khách" : ""} cho {campaign?.total} khách trong chiến dịch này? Kiểm tra đúng người nhận và nội dung trước khi xác nhận.</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={() => action("active")}>Xác nhận gửi</button><button className={button} disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button></div></div>}{(error || detail.error) && <p role="alert" className="text-sm text-red-700">{error || detail.error?.message}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}<div className="max-h-[480px] space-y-3 overflow-y-auto">{detail.data?.deliveries.map(d => <div key={d.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-800">{d.name}</p><Badge status={d.status} /></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{d.message}</p>{d.pdf_name && <a className="mt-3 inline-flex text-sm font-medium text-emerald-800 underline underline-offset-4" href={`/api/zalo/campaigns/${id}/deliveries/${d.id}/pdf${suffix}`} target="_blank" rel="noopener noreferrer">Xem PDF báo giá đính kèm</a>}{d.error && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{d.error}</p>}</div>)}</div><p className="text-xs text-slate-400">Trạng thái “Đã gửi” chưa xác nhận khách đã đọc. Tin cần đối soát không được tự gửi lại.</p></div>;
}
