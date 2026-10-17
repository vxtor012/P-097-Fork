"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw, UserRound, ShieldCheck, Store as StoreIcon, Power, X } from "lucide-react";
import { apiRequest, useStaffData } from "@/hooks/use-staff-data";

type Staff = { id: string; name: string; email: string; role: "seller" | "warehouse" | "warehouse_manager" | "admin"; dealer_id: string | null; dealer: string | null; store_ids: string[]; is_active: boolean; created_at: string | null };
type Dealer = { id: string; name: string; province: string };
type Store = { id: string; dealer_id: string; name: string; address: string | null };
const ROLE: Record<string, string> = { seller: "Nhân viên kinh doanh", warehouse: "Thủ kho", warehouse_manager: "Quản lý kho", admin: "Quản trị viên" };

export default function AdminStaffPage() {
  const staffQuery = useStaffData<{ staff: Staff[] }>("admin-staff", "/api/admin/staff");
  const dealerQuery = useStaffData<{ dealers: Dealer[] }>("admin-dealers", "/api/dealers");
  const storeQuery = useStaffData<{ stores: Store[] }>("admin-stores", "/api/stores");
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rows = staffQuery.data?.staff ?? [];
  const queryError = staffQuery.error?.message || dealerQuery.error?.message || storeQuery.error?.message;

  const toggleActive = async (user: Staff) => {
    setError(""); setNotice(""); setBusyId(user.id);
    try {
      await apiRequest(`/api/admin/staff/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !user.is_active }) });
      await staffQuery.refetch();
      setNotice(user.is_active ? `Đã khóa tài khoản ${user.name}.` : `Đã kích hoạt tài khoản ${user.name}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Không cập nhật được tài khoản."); }
    finally { setBusyId(""); }
  };

  return (
    <div className="space-y-6 p-6 lg:p-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Nhân sự</h1><p className="mt-2 text-sm text-slate-500">Tạo tài khoản và phân công nhân viên vào đại lý, cửa hàng.</p></div>
        <div className="flex gap-2"><button onClick={() => staffQuery.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Làm mới</button><button onClick={() => { setOpen(true); setError(""); setNotice(""); }} className="inline-flex items-center gap-2 rounded-xl bg-[#134c40] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f3d34]"><Plus size={16} /> Tạo tài khoản</button></div>
      </header>

      {(queryError || error) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || queryError}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={UserRound} label="Tổng nhân sự" value={rows.filter((row) => row.role !== "admin").length} />
        <Summary icon={ShieldCheck} label="Đang hoạt động" value={rows.filter((row) => row.role !== "admin" && row.is_active).length} />
        <Summary icon={StoreIcon} label="Thủ kho" value={rows.filter((row) => row.role === "warehouse" && row.is_active).length} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Tài khoản nội bộ</h2><p className="mt-1 text-xs text-slate-500">Admin có thể tạo nhân sự và khóa/mở tài khoản hiện có.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{rows.length} tài khoản</span></div>
        {staffQuery.isPending ? <div className="p-12 text-center text-sm text-slate-500">Đang tải danh sách nhân viên…</div> : rows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">Chưa có tài khoản nhân viên.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nhân viên</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Đại lý</th><th className="px-4 py-3">Phạm vi kho</th><th className="px-4 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((person) => <tr key={person.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{person.name}</p><p className="mt-1 text-xs text-slate-500">{person.email}</p></td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{ROLE[person.role] || person.role}</span></td><td className="px-4 py-4 text-slate-600">{person.dealer || "—"}</td><td className="px-4 py-4 text-slate-600">{person.role === "warehouse" ? `${person.store_ids.length} cửa hàng` : person.role === "admin" ? "Toàn hệ thống" : "Toàn đại lý"}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${person.is_active ? "text-emerald-700" : "text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${person.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />{person.is_active ? "Đang hoạt động" : "Đã khóa"}</span></td><td className="px-5 py-4 text-right">{person.role === "admin" ? <span className="text-xs text-slate-400">Bảo vệ</span> : <button disabled={busyId === person.id} onClick={() => toggleActive(person)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-white disabled:opacity-50"><Power size={14} />{person.is_active ? "Khóa" : "Mở khóa"}</button>}</td></tr>)}</tbody></table></div>}
      </div>

      {open && <CreateStaffModal dealers={dealerQuery.data?.dealers ?? []} stores={storeQuery.data?.stores ?? []} onClose={() => setOpen(false)} onCreated={async () => { await staffQuery.refetch(); setOpen(false); setNotice("Đã tạo tài khoản nhân viên."); }} onError={setError} />}
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: number }) { return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={19} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div></div>; }

function CreateStaffModal({ dealers, stores, onClose, onCreated, onError }: { dealers: Dealer[]; stores: Store[]; onClose: () => void; onCreated: () => Promise<void>; onError: (error: string) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [role, setRole] = useState<"seller" | "warehouse" | "warehouse_manager">("seller"); const [dealerId, setDealerId] = useState(dealers[0]?.id ?? ""); const [storeIds, setStoreIds] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const availableStores = useMemo(() => stores.filter((store) => store.dealer_id === dealerId), [stores, dealerId]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); onError(""); try { await apiRequest("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role, dealer_id: dealerId, store_ids: role === "warehouse" ? storeIds : [] }) }); await onCreated(); } catch (error) { onError(error instanceof Error ? error.message : "Không thể tạo tài khoản."); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Tài khoản mới</p><h2 className="mt-1 text-xl font-bold text-slate-900">Tạo nhân viên</h2></div><button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Họ và tên"><input required minLength={2} maxLength={255} value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Nguyễn Văn An" /></Field><Field label="Email đăng nhập"><input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="ten@congty.vn" /></Field></div>
    <Field label="Mật khẩu khởi tạo"><input required type="password" minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="Ít nhất 12 ký tự" /><span className="text-xs text-slate-500">Chia sẻ mật khẩu khởi tạo riêng với nhân viên.</span></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Vai trò"><select value={role} onChange={(e) => { setRole(e.target.value as typeof role); setStoreIds([]); }} className={input}><option value="seller">Nhân viên kinh doanh</option><option value="warehouse">Thủ kho</option><option value="warehouse_manager">Quản lý kho</option></select></Field><Field label="Đại lý"><select required value={dealerId} onChange={(e) => { setDealerId(e.target.value); setStoreIds([]); }} className={input}><option value="">Chọn đại lý</option>{dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.name} · {dealer.province}</option>)}</select></Field></div>
    {role === "warehouse" && <Field label="Cửa hàng được phân công"><div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{availableStores.length ? availableStores.map((store) => <label key={store.id} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={storeIds.includes(store.id)} onChange={(e) => setStoreIds((ids) => e.target.checked ? [...ids, store.id] : ids.filter((id) => id !== store.id))} className="mt-1 accent-emerald-800" /><span>{store.name}<span className="block text-xs text-slate-400">{store.address}</span></span></label>) : <p className="text-sm text-slate-500">Đại lý này chưa có cửa hàng.</p>}</div><span className="text-xs text-slate-500">Thủ kho chỉ xem và sửa tồn kho ở các cửa hàng được chọn.</span></Field>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Hủy</button><button disabled={saving || !dealerId || (role === "warehouse" && storeIds.length === 0)} className="rounded-xl bg-[#134c40] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang tạo…" : "Tạo tài khoản"}</button></div>
  </form></div>;
}
const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1 text-sm font-medium text-slate-700">{label}{children}</label>; }
