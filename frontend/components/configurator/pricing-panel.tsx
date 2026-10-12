"use client";

import { useState } from "react";

import { VEHICLES } from "@/lib/vehicle-data";
import { formatVND } from "@/lib/format";
import { useConfigurator } from "@/hooks/use-configurator";
import { Info, Car, Gift, FileDown, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  configurator: ReturnType<typeof useConfigurator>;
  onRequestQuote: () => void;
}

export function PricingPanel({ configurator, onRequestQuote }: Props) {
  const { config, pricing } = configurator;
  const vehicle = VEHICLES[config.model];
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleExportPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch("/api/quote/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          version: pricing.version.label,
          color: pricing.color.label,
          battery: config.battery,
          province: pricing.province.label,
          final_price: pricing.finalPrice,
          price_version: "2025-Q4-v1",
          price_snapshot: {
            base_price: pricing.basePrice,
            battery_cost: pricing.batteryPrice,
            accessories: pricing.accList.map((a) => ({ name: a.label, price: a.price })),
            rolling_costs: {
              registration_fee: pricing.registrationFee,
              plate_fee: pricing.plateFee,
              road_fee: pricing.roadFee,
              inspection_fee: pricing.inspectionFee,
              insurance: pricing.insuranceFee,
            },
            promotions: pricing.promos,
            final_price: pricing.finalPrice,
          },
        }),
      });

      if (!res.ok) throw new Error("Không thể tạo PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VinFast_BaoGia_${config.model}_${pricing.version.label}.pdf`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Lỗi khi tạo PDF báo giá.");
    } finally {
      setDownloadingPdf(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Xe preview */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 px-8 py-10 flex items-center justify-center min-h-[220px]">
          <div className="text-center">
            {/* Placeholder hình xe */}
            <div className="w-48 h-28 mx-auto mb-4 flex items-center justify-center">
              <div
                className="w-full h-full rounded-xl flex items-center justify-center shadow-inner"
                style={{ backgroundColor: pricing.color.hex, border: "1px solid rgba(0,0,0,0.1)" }}
              >
                <Car size={36} className="text-white drop-shadow-md" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              VinFast {vehicle.label}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {pricing.version.label} · {pricing.color.label}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="px-6 py-3 border-t flex flex-wrap gap-2">
          <Tag label={`Pin: ${config.battery === "rent" ? "Thuê" : "Mua"}`} color="blue" />
          <Tag label={pricing.province.label} color="gray" />
          {config.accessories.length > 0 && (
            <Tag label={`${config.accessories.length} phụ kiện`} color="green" />
          )}
        </div>
      </div>

      {/* Bảng chi phí — giống VinFast */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">Chi phí lăn bánh</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Tại {pricing.province.label} · Giá tham khảo
          </p>
        </div>

        <div className="divide-y">
          {/* Giá xe */}
          <PriceRow
            label="Giá xe"
            sub={`${vehicle.label} ${pricing.version.label}`}
            value={pricing.basePrice}
          />

          {/* Pin */}
          {pricing.batteryPrice > 0 && (
            <PriceRow
              label="Giá pin"
              sub="Mua đứt"
              value={pricing.batteryPrice}
            />
          )}
          {config.battery === "rent" && (
            <PriceRow
              label="Thuê pin"
              sub={`${formatVND(pricing.batteryRent)}/tháng — không tính vào lăn bánh`}
              value={0}
              note
            />
          )}

          {/* Phụ kiện */}
          {pricing.accList.map((acc) => (
            <PriceRow key={acc.id} label={acc.label} sub="Phụ kiện" value={acc.price} />
          ))}

          {/* Divider phí lăn bánh */}
          <div className="px-6 py-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Phí trước khi lăn bánh
            </p>
          </div>

          <PriceRow
            label="Lệ phí trước bạ"
            sub={`${pricing.province.registrationRate * 100}% giá xe`}
            value={pricing.registrationFee}
          />
          <PriceRow label="Phí đường bộ" sub="Theo năm" value={pricing.roadFee} />
          <PriceRow label="Phí đăng kiểm" sub="Lần đầu" value={pricing.inspectionFee} />
          <PriceRow
            label="Bảo hiểm bắt buộc"
            sub="1.5% giá xe"
            value={pricing.insuranceFee}
          />
          <PriceRow
            label="Phí biển số"
            sub={pricing.province.label}
            value={pricing.plateFee}
          />

          {/* Khuyến mãi */}
          {pricing.promos.length > 0 && (
            <>
              <div className="px-6 py-3 bg-green-50 flex items-center gap-1.5">
                <Gift size={14} className="text-green-700" />
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Ưu đãi đang áp dụng
                </p>
              </div>
              {pricing.promos.map((p) => (
                <div key={p.name} className="px-6 py-3.5 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-green-700 font-medium">{p.name}</p>
                    <p className="text-xs text-green-500">{p.source}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">
                    -{formatVND(p.value)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* TỔNG */}
        <div className="px-6 py-5 bg-blue-600 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-200 text-sm">Tổng chi phí lăn bánh</p>
              <p className="text-xs text-blue-300 mt-0.5">Đã bao gồm tất cả phí & ưu đãi</p>
            </div>
            <p className="text-3xl font-bold">{formatVND(pricing.finalPrice)}</p>
          </div>
          {pricing.discount > 0 && (
            <p className="text-blue-200 text-xs mt-2 text-right flex items-center justify-end gap-1">
              <Gift size={12} className="shrink-0" />
              <span>Tiết kiệm {formatVND(pricing.discount)} so với giá niêm yết</span>
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-3 bg-yellow-50 flex gap-2">
          <Info size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700 leading-relaxed">
            Chi phí trên chỉ mang tính tham khảo. Giá thực tế có thể thay đổi theo thời điểm
            và chính sách của từng đại lý. Vui lòng liên hệ đại lý để xác nhận.
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleExportPdf}
          disabled={downloadingPdf}
          className="flex-1 py-3 rounded-xl border border-blue-600 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {downloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
          <span>{downloadingPdf ? "Đang tạo PDF..." : "Xuất PDF báo giá"}</span>
        </button>
        <button onClick={onRequestQuote} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2">
          <CheckCircle2 size={15} />
          <span>Yêu cầu báo giá chính thức</span>
        </button>
      </div>
    </div>
  );
}

function PriceRow({
  label, sub, value, note,
}: {
  label: string;
  sub?: string;
  value: number;
  note?: boolean;
}) {
  return (
    <div className="px-6 py-3.5 flex justify-between items-center">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {note ? (
        <span className="text-xs text-gray-400 italic">Không tính</span>
      ) : (
        <span className="text-sm font-semibold text-gray-900">{formatVND(value)}</span>
      )}
    </div>
  );
}

function Tag({ label, color }: { label: string; color: "blue" | "gray" | "green" }) {
  const cls = {
    blue:  "bg-blue-100 text-blue-700",
    gray:  "bg-gray-100 text-gray-600",
    green: "bg-green-100 text-green-700",
  }[color];
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  );
}
