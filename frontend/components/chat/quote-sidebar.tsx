"use client";

import { PriceQuoteData, InstallmentData } from "@/types/chat";
import { formatVND } from "@/lib/format";
import { Gift, Info, CheckCircle2, FileDown } from "lucide-react";

type QuoteData = PriceQuoteData | InstallmentData;

export function QuoteSidebar({ data }: { data: QuoteData }) {
  if (data.type === "price_quote") {
    return <PriceQuoteSidebar data={data} />;
  }
  if (data.type === "installment") {
    return <InstallmentSidebar data={data} />;
  }
  return null;
}

function PriceQuoteSidebar({ data }: { data: PriceQuoteData }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b bg-blue-600 text-white">
        <p className="text-xs text-blue-200">Báo giá tham khảo</p>
        <p className="font-bold text-lg mt-0.5">{data.model} {data.version}</p>
        <p className="text-blue-200 text-sm">{data.color}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
        {/* Final */}
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Giá lăn bánh tại {data.province}</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">
            {formatVND(data.final_price)}
          </p>
          {data.total_discount > 0 && (
            <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
              <Gift size={12} className="shrink-0" />
              <span>Đang tiết kiệm {formatVND(data.total_discount)}</span>
            </p>
          )}
        </div>

        {/* Breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Chi tiết
          </p>
          <SideRow label="Giá xe" value={data.base_price} />
          <SideRow label="Pin" value={data.battery_cost} />
          {data.accessories.map((a) => (
            <SideRow key={a.name} label={a.name} value={a.price} />
          ))}
          <div className="border-t pt-2 space-y-1.5">
            <SideRow label="Đăng ký, trước bạ" value={data.rolling_costs.registration_fee} />
            <SideRow label="Phí đường bộ" value={data.rolling_costs.road_fee} />
            <SideRow label="Đăng kiểm" value={data.rolling_costs.inspection_fee} />
            <SideRow label="Bảo hiểm" value={data.rolling_costs.insurance} />
            <SideRow label="Biển số" value={data.rolling_costs.plate_fee} />
          </div>
          {data.promotions.length > 0 && (
            <div className="border-t pt-2 space-y-1.5">
              {data.promotions.map((p) => (
                <div key={p.name} className="flex justify-between text-green-700 text-xs items-center">
                  <span className="flex-1 pr-2 flex items-center gap-1">
                    <Gift size={11} className="shrink-0" />
                    <span>{p.name}</span>
                  </span>
                  <span>-{formatVND(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 leading-relaxed flex items-start gap-1.5">
          <Info size={13} className="shrink-0 mt-0.5 text-gray-400" />
          <span>{data.disclaimer}</span>
        </p>
      </div>

      <div className="px-5 py-4 border-t space-y-2">
        <button className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2">
          <CheckCircle2 size={15} />
          <span>Yêu cầu báo giá chính thức</span>
        </button>
        <button className="w-full py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors flex items-center justify-center gap-2">
          <FileDown size={15} />
          <span>Xuất PDF</span>
        </button>
      </div>
    </div>
  );
}

function InstallmentSidebar({ data }: { data: InstallmentData }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b bg-purple-600 text-white">
        <p className="text-xs text-purple-200">Kế hoạch trả góp</p>
        <p className="font-bold text-lg mt-0.5">{data.bank}</p>
        <p className="text-purple-200 text-sm">
          {data.term_months} tháng · {(data.interest_rate * 100).toFixed(1)}%/năm
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">Trả hàng tháng</p>
          <p className="text-3xl font-bold text-purple-700 mt-1">
            {formatVND(data.monthly_payment)}
          </p>
        </div>

        <div className="space-y-2">
          <SideRow label="Giá xe" value={data.total_price} />
          <SideRow label="Trả trước" value={data.down_payment} />
          <SideRow label="Số tiền vay" value={data.loan_amount} />
          <SideRow label="Tổng lãi" value={data.total_interest} red />
          <SideRow label="Tổng phải trả" value={data.total_paid} />
        </div>

        {/* Schedule */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Lịch trả nợ
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="pb-1.5 text-left">T</th>
                <th className="pb-1.5 text-right">Gốc</th>
                <th className="pb-1.5 text-right">Lãi</th>
                <th className="pb-1.5 text-right">Dư nợ</th>
              </tr>
            </thead>
            <tbody>
              {data.schedule.map((row) => (
                <tr key={row.month} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-600">{row.month}</td>
                  <td className="py-1.5 text-right">{formatVND(row.principal)}</td>
                  <td className="py-1.5 text-right text-red-400">{formatVND(row.interest)}</td>
                  <td className="py-1.5 text-right text-gray-600">{formatVND(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 flex items-start gap-1.5">
          <Info size={13} className="shrink-0 mt-0.5 text-gray-400" />
          <span>{data.disclaimer}</span>
        </p>
      </div>
    </div>
  );
}

function SideRow({
  label,
  value,
  red,
}: {
  label: string;
  value: number;
  red?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs text-gray-600">
      <span>{label}</span>
      <span className={`font-medium ${red ? "text-red-500" : "text-gray-900"}`}>
        {formatVND(value)}
      </span>
    </div>
  );
}
