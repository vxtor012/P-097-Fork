"use client";

import { useState } from "react";
import { X, User, Phone, MapPin, FileText, Loader2, CheckCircle2, Lock } from "lucide-react";

export interface BuyerInfo {
  name:    string;
  phone:   string;
  province:string;
  note:    string;
}

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onConfirm: (info: BuyerInfo) => void;
  finalPrice:number;
  carConfig: string; // "VF6 Plus · Trắng Tinh Khôi · Hà Nội"
}

export function BuyerIdentityModal({
  isOpen, onClose, onConfirm, finalPrice, carConfig,
}: Props) {
  const [form, setForm] = useState<BuyerInfo>({
    name: "", phone: "", province: "", note: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const set = (k: keyof BuyerInfo, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Giả lập gửi API
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
    // Sau 1.5s đóng modal
    setTimeout(() => {
      onConfirm(form);
      onClose();
      setSubmitted(false);
      setForm({ name: "", phone: "", province: "", note: "" });
    }, 1500);
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
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
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
              Tư vấn viên sẽ liên hệ với <strong>{form.name}</strong> qua số{" "}
              <strong>{form.phone}</strong> trong vòng 30 phút.
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
                  pattern="[0-9]{10,11}"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Province */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Tỉnh / Thành phố</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={form.province}
                  onChange={(e) => set("province", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  <option value="">-- Chọn tỉnh --</option>
                  {["Hà Nội","TP. Hồ Chí Minh","Đà Nẵng","Hải Phòng","Cần Thơ","Bình Dương","Tỉnh khác"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Ghi chú thêm</label>
              <div className="relative">
                <FileText size={14} className="absolute left-3 top-3 text-gray-400" />
                <textarea
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
              <span>Thông tin chỉ dùng để tư vấn viên liên hệ. Không chia sẻ bên thứ 3.</span>
            </p>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
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
