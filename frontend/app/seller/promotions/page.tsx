"use client";

import { useState } from "react";
import { PROMOTIONS, Promotion } from "@/lib/seller-mock-data";
import { formatVND } from "@/lib/format";
import { Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Sparkles } from "lucide-react";

export default function PromotionsPage() {
  const [promos, setPromos]   = useState<Promotion[]>(PROMOTIONS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Promotion | null>(null);

  const handleToggle = (id: string) => {
    setPromos((p) => p.map((x) => x.id === id ? { ...x, isActive: !x.isActive } : x));
  };

  const handleDelete = (id: string) => {
    if (!confirm("Xoá khuyến mãi này?")) return;
    setPromos((p) => p.filter((x) => x.id !== id));
  };

  const handleSave = (data: Omit<Promotion, "id" | "usageCount">) => {
    if (editing) {
      setPromos((p) => p.map((x) => x.id === editing.id ? { ...x, ...data } : x));
    } else {
      setPromos((p) => [...p, { ...data, id: Date.now().toString(), usageCount: 0 }]);
    }
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khuyến mãi</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý chương trình ưu đãi của đại lý</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Thêm khuyến mãi
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Đang active", value: promos.filter((p) => p.isActive).length, color: "text-green-600 bg-green-50" },
          { label: "Đã hết hạn",  value: promos.filter((p) => !p.isActive).length, color: "text-slate-500 bg-slate-50"  },
          { label: "Tổng lượt dùng", value: promos.reduce((s, p) => s + p.usageCount, 0), color: "text-blue-600 bg-blue-50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color.split(" ")[1]} shadow-sm`}>
            <p className="text-xs text-slate-500">{s.label}</p>
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
                <th className="px-4 py-3 text-center">Lượt dùng</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.description.slice(0, 50)}...</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      {p.model}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-green-700">
                    {p.discountType === "fixed"
                      ? `-${formatVND(p.discountValue)}`
                      : `-${p.discountValue}%`}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {p.startDate} → {p.endDate}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-slate-700 font-medium">{p.usageCount}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button onClick={() => handleToggle(p.id)}>
                      {p.isActive
                        ? <ToggleRight size={28} className="text-green-500 mx-auto" />
                        : <ToggleLeft  size={28} className="text-slate-300 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <PromotionForm
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function PromotionForm({
  initial, onSave, onClose,
}: {
  initial: Promotion | null;
  onSave: (data: Omit<Promotion, "id" | "usageCount">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name:          initial?.name          ?? "",
    description:   initial?.description   ?? "",
    model:         initial?.model         ?? "ALL",
    province:      initial?.province      ?? "",
    discountType:  initial?.discountType  ?? "fixed" as "fixed" | "percent",
    discountValue: initial?.discountValue ?? 0,
    startDate:     initial?.startDate     ?? "",
    endDate:       initial?.endDate       ?? "",
    isActive:      initial?.isActive      ?? true,
  });

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, province: form.province || null });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-900">
            {initial ? "Sửa khuyến mãi" : "Thêm khuyến mãi mới"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Tên chương trình *">
            <input
              required value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="VD: Ưu đãi tháng 10 - VF6"
              className={INPUT}
            />
          </Field>

          <Field label="Mô tả">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2} className={INPUT} placeholder="Mô tả ngắn về chương trình..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dòng xe áp dụng">
              <select value={form.model} onChange={(e) => set("model", e.target.value)} className={INPUT}>
                {["ALL","VF3","VF5","VF6","VF7","VF8","VF9"].map((m) => (
                  <option key={m} value={m}>{m === "ALL" ? "Tất cả" : m}</option>
                ))}
              </select>
            </Field>
            <Field label="Tỉnh/thành (để trống = toàn quốc)">
              <input
                value={form.province} onChange={(e) => set("province", e.target.value)}
                placeholder="VD: Hà Nội" className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Loại giảm giá">
              <select value={form.discountType} onChange={(e) => set("discountType", e.target.value)} className={INPUT}>
                <option value="fixed">Số tiền cố định (VNĐ)</option>
                <option value="percent">Phần trăm (%)</option>
              </select>
            </Field>
            <Field label={form.discountType === "fixed" ? "Số tiền giảm (VNĐ)" : "% giảm"}>
              <input
                required type="number" min={0}
                value={form.discountValue}
                onChange={(e) => set("discountValue", Number(e.target.value))}
                className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ngày bắt đầu *">
              <input
                required type="date" value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)} className={INPUT}
              />
            </Field>
            <Field label="Ngày kết thúc *">
              <input
                required type="date" value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)} className={INPUT}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set("isActive", !form.isActive)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${form.isActive ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
            </div>
            <span className="text-sm text-slate-700">Kích hoạt ngay</span>
          </label>

          {/* Note: auto sync to WeKnora */}
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Sparkles size={14} className="shrink-0 mt-0.5 text-blue-600" />
            <span>Sau khi lưu, khuyến mãi sẽ tự động được đồng bộ lên hệ thống AI — Agent sẽ tư vấn chương trình này cho khách hàng ngay lập tức.</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Huỷ
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
              {initial ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
