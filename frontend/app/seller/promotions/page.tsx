"use client";

import type { PromotionResponse } from "@/lib/api-types";

import { useState } from "react";
import { useStaffData, apiRequest, refreshStaffData } from "@/hooks/use-staff-data";
import { formatVND } from "@/lib/format";
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Sparkles, RefreshCw } from "lucide-react";

export interface PromotionItem {
  id: string;
  name: string;
  description: string;
  model: string;
  province: string | null;
  discountType: "fixed" | "percent";
  discountValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount: number;
  editable?: boolean;
  currentlyValid?: boolean;
}

function promotionDate(value: string) {
  return new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default function PromotionsPage() {
  const query = useStaffData<{ promotions: PromotionResponse[] }>('seller-promotions', '/api/promotions');
  const promos: PromotionItem[] = (query.data?.promotions ?? []).map((p) => ({
    id: p.id, name: p.name, description: p.description ?? '', model: p.model, province: p.province,
    discountType: p.discount_type, discountValue: p.discount_value, startDate: promotionDate(p.start_date),
    endDate: promotionDate(p.end_date), isActive: p.is_active, usageCount: p.usage_count, editable: p.editable,
    currentlyValid: p.currently_valid,
  }));
  const loading = query.isPending;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromotionItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const change = async (url: string, method: string, payload?: object) => {
    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
    await refreshStaffData();
  };
  const handleToggle = async (id: string, current: boolean) => {
    if (busy) return;
    setBusy(true); setActionError('');
    try { await change('/api/promotions/' + id, 'PATCH', { is_active: !current }); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Cập nhật chưa thành công.'); }
    finally { setBusy(false); }
  };
  const handleDelete = async (id: string) => {
    if (busy || !confirm('Vô hiệu hóa khuyến mãi này?')) return;
    setBusy(true); setActionError('');
    try { await change('/api/promotions/' + id, 'DELETE'); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Thao tác chưa thành công.'); }
    finally { setBusy(false); }
  };
  const handleSave = async (data: Omit<PromotionItem, 'id' | 'usageCount'>) => {
    await change(editing ? '/api/promotions/' + editing.id : '/api/promotions', editing ? 'PATCH' : 'POST', {
      name: data.name, description: data.description, model: data.model, province: data.province,
      discount_type: data.discountType, discount_value: data.discountValue,
      start_date: data.startDate + 'T00:00:00+07:00', end_date: data.endDate + 'T23:59:59+07:00', is_active: data.isActive,
    });
    setShowForm(false); setEditing(null);
  };

  return (
    <div className="p-6 space-y-6">
      {(query.error || actionError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError || query.error?.message}</p>}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khuyến mãi (Promotions)</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý chương trình ưu đãi của đại lý</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => query.refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} /> Thêm khuyến mãi
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Đang hiệu lực",
            value: promos.filter((p) => p.currentlyValid).length,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Chưa hiệu lực / tạm dừng",
            value: promos.filter((p) => !p.currentlyValid).length,
            color: "text-slate-500 bg-slate-50",
          },
          {
            label: "Lượt báo giá áp dụng",
            value: promos.reduce((s, p) => s + p.usageCount, 0),
            color: "text-blue-600 bg-blue-50",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color.split(" ")[1]} shadow-sm`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color.split(" ")[0]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Tên chương trình</th>
                <th className="px-4 py-3 text-left">Dòng xe</th>
                <th className="px-4 py-3 text-left">Giảm giá</th>
                <th className="px-4 py-3 text-left">Thời gian</th>
                <th className="px-4 py-3 text-center">Lượt báo giá</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && promos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Đang tải danh sách khuyến mãi...
                  </td>
                </tr>
              ) : promos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Chưa có khuyến mãi nào trong hệ thống
                  </td>
                </tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">
                          {p.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">
                        {p.model}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-green-700">
                      {p.discountType === "fixed"
                        ? `-${formatVND(p.discountValue)}`
                        : `-${p.discountValue}%`}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {p.startDate} → {p.endDate}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-slate-700 font-semibold">{p.usageCount}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        disabled={busy || !p.editable}
                        onClick={() => handleToggle(p.id, p.isActive)}
                        className="transition-transform active:scale-95"
                      >
                        {p.isActive ? (
                          <ToggleRight size={28} className="text-green-500 mx-auto" />
                        ) : (
                          <ToggleLeft size={28} className="text-slate-300 mx-auto" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditing(p);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          disabled={busy || !p.editable}
                          title="Sửa"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          disabled={busy || !p.editable}
                          title="Vô hiệu hoá"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <PromotionForm
          initial={editing}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PromotionForm({
  initial,
  onSave,
  onClose,
}: {
  initial: PromotionItem | null;
  onSave: (data: Omit<PromotionItem, "id" | "usageCount">) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    model: initial?.model ?? "ALL",
    province: initial?.province ?? "",
    discountType: (initial?.discountType ?? "fixed") as "fixed" | "percent",
    discountValue: initial?.discountValue ?? 0,
    startDate: initial?.startDate ?? promotionDate(new Date().toISOString()),
    endDate:
      initial?.endDate ??
      promotionDate(new Date(Date.now() + 30 * 864e5).toISOString()),
    isActive: initial?.isActive ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await onSave({ ...form, province: form.province || null }); }
    catch (error) { setError(error instanceof Error ? error.message : 'Lưu khuyến mãi chưa thành công.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-900 text-lg">
            {initial ? "Sửa chương trình khuyến mãi" : "Thêm khuyến mãi mới"}
          </h2>
          <button disabled={saving} onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Tên chương trình *">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="VD: Ưu đãi tháng 10 - VF6"
              className={INPUT}
            />
          </Field>

          <Field label="Mô tả">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className={INPUT}
              placeholder="Mô tả chi tiết điều kiện áp dụng..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dòng xe áp dụng">
              <select
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                className={INPUT}
              >
                {["ALL", "VF3", "VF5", "VF6", "VF7", "VF8", "VF9"].map((m) => (
                  <option key={m} value={m}>
                    {m === "ALL" ? "Tất cả" : m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tỉnh/thành (để trống = toàn quốc)">
              <input
                value={form.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder="VD: Hà Nội"
                className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Loại giảm giá">
              <select
                value={form.discountType}
                onChange={(e) => set("discountType", e.target.value)}
                className={INPUT}
              >
                <option value="fixed">Số tiền cố định (VNĐ)</option>
                <option value="percent">Phần trăm (%)</option>
              </select>
            </Field>
            <Field label={form.discountType === "fixed" ? "Số tiền giảm (VNĐ)" : "% giảm"}>
              <input
                required
                type="number"
                min={0}
                value={form.discountValue}
                onChange={(e) => set("discountValue", Number(e.target.value))}
                className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ngày bắt đầu *">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Ngày kết thúc *">
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700">Kích hoạt chương trình ngay</span>
          </label>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Sparkles size={14} className="shrink-0 mt-0.5 text-blue-600" />
            <span>
              Sau khi lưu, chương trình ưu đãi sẽ tự động đồng bộ vào cơ sở dữ liệu để hệ thống tính giá và Trợ lý AI có thể tư vấn ngay.
            </span>
          </div>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
            >
              {initial ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
