"use client";

import { useState, useEffect } from "react";
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
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromotionItem | null>(null);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promotions");
      if (res.ok) {
        const data = await res.json();
        const mapped: PromotionItem[] = (data.promotions || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          model: p.model || "ALL",
          province: p.province || null,
          discountType: p.discount_type || "fixed",
          discountValue: Number(p.discount_value) || 0,
          startDate: p.start_date ? p.start_date.slice(0, 10) : "",
          endDate: p.end_date ? p.end_date.slice(0, 10) : "",
          isActive: Boolean(p.is_active),
          usageCount: Number(p.usage_count) || 0,
        }));
        setPromos(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      if (res.ok) {
        setPromos((prev) =>
          prev.map((x) => (x.id === id ? { ...x, isActive: !current } : x))
        );
      }
    } catch (err) {
      console.error("Failed to toggle promotion:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Vô hiệu hoá khuyến mãi này?")) return;
    try {
      const res = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPromos((prev) =>
          prev.map((x) => (x.id === id ? { ...x, isActive: false } : x))
        );
      }
    } catch (err) {
      console.error("Failed to delete promotion:", err);
    }
  };

  const handleSave = async (data: Omit<PromotionItem, "id" | "usageCount">) => {
    try {
      const payload = {
        name: data.name,
        description: data.description,
        model: data.model,
        province: data.province,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        start_date: data.startDate ? `${data.startDate}T00:00:00` : new Date().toISOString(),
        end_date: data.endDate ? `${data.endDate}T23:59:59` : new Date().toISOString(),
        is_active: data.isActive,
      };

      if (editing) {
        const res = await fetch(`/api/promotions/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await fetchPromotions();
        }
      } else {
        const res = await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await fetchPromotions();
        }
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error("Failed to save promotion:", err);
      alert("Không thể lưu khuyến mãi. Vui lòng kiểm tra lại thông tin!");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khuyến mãi (Promotions)</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý chương trình ưu đãi của đại lý</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPromotions}
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
            label: "Đang kích hoạt",
            value: promos.filter((p) => p.isActive).length,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Đã tạm dừng / hết hạn",
            value: promos.filter((p) => !p.isActive).length,
            color: "text-slate-500 bg-slate-50",
          },
          {
            label: "Tổng lượt dùng",
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
                <th className="px-4 py-3 text-center">Lượt dùng</th>
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
                          title="Sửa"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
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
  onSave: (data: Omit<PromotionItem, "id" | "usageCount">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    model: initial?.model ?? "ALL",
    province: initial?.province ?? "",
    discountType: (initial?.discountType ?? "fixed") as "fixed" | "percent",
    discountValue: initial?.discountValue ?? 0,
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate:
      initial?.endDate ??
      new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    isActive: initial?.isActive ?? true,
  });

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, province: form.province || null });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-900 text-lg">
            {initial ? "Sửa chương trình khuyến mãi" : "Thêm khuyến mãi mới"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
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
