"use client";

import { useState } from "react";
import { X, User, Phone, FileText, Loader2, CheckCircle2, Lock } from "lucide-react";

export interface BuyerInfo {
  name:    string;
  phone:   string;
  note:    string;
}

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onConfirm: (info: BuyerInfo) => void | Promise<void>;
  finalPrice:number;
  carConfig: string; // "VF6 Plus · Trắng Tinh Khôi · Hà Nội"
}

export function BuyerIdentityModal({
  isOpen, onClose, onConfirm, finalPrice, carConfig,
}: Props) {
  const [form, setForm] = useState<BuyerInfo>({
    name: "", phone: "", note: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const set = (k: keyof BuyerInfo, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onConfirm(form);
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setForm({ name: "", phone: "", note: "" });
      }, 1500);
    } catch (err: unknown) {
      setLoading(false);
      setError((err instanceof Error ? err.message : null) || "Không thể gửi yêu cầu báo giá. Vui lòng thử lại!");
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-600 text-white">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              <FileText size={18} />
              <span>Yêu cầu báo giá chính thức</span>
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">
              Tư vấn viên sẽ liên hệ xác nhận giá
            </p>
          </div>
          <button disabled={loading} onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50" aria-label="Đóng biểu mẫu">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          /* Success state */
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={34} className="text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Đã gửi thành công!</h3>
            <p className="text-gray-500 text-sm mt-2">
              Đại lý đã nhận thông tin của <strong>{form.name}</strong> và số{" "}
              <strong>{form.phone}</strong> để tư vấn.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Car summary */}
            <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Cấu hình đang xem</p>
                <p className="text-sm font-semibold text-gray-900">{carConfig}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Dự tính</p>
                <p className="font-bold text-blue-700 text-sm">
                  {new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                    maximumFractionDigits: 0,
                  }).format(finalPrice)}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Điền thông tin để tư vấn viên liên hệ xác nhận giá chính thức
            </p>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="0912 345 678"
                  pattern="[+0-9 ()-]{10,18}"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Ghi chú thêm</label>
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
                <textarea
                  maxLength={2000}
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="VD: Tôi muốn lái thử trước, hoặc hỏi về khuyến mãi..."
                  rows={2}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Lock size={12} className="shrink-0 text-gray-400" />
              <span>Gửi yêu cầu đồng nghĩa bạn đồng ý để đại lý đã chọn liên hệ tư vấn.</span>
            </p>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Đang gửi...</>
                ) : (
                  "Gửi yêu cầu báo giá"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
