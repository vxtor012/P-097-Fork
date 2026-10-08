"use client";

import { useState } from "react";
import { PriceQuoteData } from "@/types/chat";
import { formatVND } from "@/lib/format";
import { ChevronDown, ChevronUp, FileText, CheckCircle, Gift, Info } from "lucide-react";

export function PriceCard({ data }: { data: PriceQuoteData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-80 bg-white rounded-2xl border shadow-md overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-lg">{data.model} {data.version}</p>
            <p className="text-blue-200 text-xs mt-0.5">{data.color}</p>
          </div>
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            v{data.price_version}
          </span>
        </div>
      </div>

      {/* Final price */}
      <div className="px-4 py-3 bg-blue-50 border-b">
        <p className="text-xs text-gray-500">Giá lăn bánh tại {data.province}</p>
        <p className="text-2xl font-bold text-blue-700 mt-0.5">
          {formatVND(data.final_price)}
        </p>
        {data.total_discount > 0 && (
          <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
            <Gift size={12} className="shrink-0" />
            <span>Tiết kiệm {formatVND(data.total_discount)}</span>
          </p>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-blue-600 hover:bg-gray-50 transition-colors"
      >
        <span>Chi tiết báo giá</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Detail */}
      {open && (
        <div className="px-4 pb-3 space-y-3 border-t">
          {/* Base */}
          <div className="space-y-1.5 pt-3">
            <Row label="Giá xe niêm yết" value={data.base_price} />
            <Row
              label={`Pin (${data.battery_option === "rent" ? "thuê" : "mua"})`}
              value={data.battery_cost}
            />
            {data.accessories.map((a) => (
              <Row key={a.name} label={a.name} value={a.price} />
            ))}
          </div>

          {/* Rolling costs */}
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Phí lăn bánh
            </p>
            <Row label="Đăng ký, trước bạ" value={data.rolling_costs.registration_fee} />
            <Row label="Phí đường bộ" value={data.rolling_costs.road_fee} />
            <Row label="Phí đăng kiểm" value={data.rolling_costs.inspection_fee} />
            <Row label="Bảo hiểm bắt buộc" value={data.rolling_costs.insurance} />
            <Row label="Phí biển số" value={data.rolling_costs.plate_fee} />
          </div>

          {/* Promotions */}
          {data.promotions.length > 0 && (
            <div className="space-y-1.5 border-t pt-2">
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">
                Ưu đãi áp dụng
              </p>
              {data.promotions.map((p) => (
                <div key={p.name} className="flex justify-between text-green-700">
                  <span className="flex-1 pr-2">{p.name}</span>
                  <span className="font-medium">-{formatVND(p.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 leading-relaxed flex items-start gap-1">
            <Info size={12} className="shrink-0 mt-0.5 text-gray-400" />
            <span>{data.disclaimer}</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2 border-t pt-3">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <FileText size={13} /> Xuất PDF
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
          <CheckCircle size={13} /> Báo giá chính thức
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-gray-600 text-xs">
      <span>{label}</span>
      <span className="font-medium text-gray-800">{formatVND(value)}</span>
    </div>
  );
}
