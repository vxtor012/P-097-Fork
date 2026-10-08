"use client";

import { useState } from "react";
import { InstallmentData } from "@/types/chat";
import { formatVND } from "@/lib/format";
import { ChevronDown, ChevronUp, CreditCard, Info } from "lucide-react";

export function InstallmentCard({ data }: { data: InstallmentData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-80 bg-white rounded-2xl border shadow-md overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3">
        <p className="font-bold flex items-center gap-1.5">
          <CreditCard size={15} />
          <span>Kế hoạch trả góp</span>
        </p>
        <p className="text-purple-200 text-xs mt-0.5">
          {data.bank} · {data.term_months} tháng · {(data.interest_rate * 100).toFixed(1)}%/năm
        </p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-3 divide-x border-b">
        {[
          { label: "Trả trước", value: data.down_payment },
          { label: "Vay", value: data.loan_amount },
          { label: "Hàng tháng", value: data.monthly_payment },
        ].map((item) => (
          <div key={item.label} className="px-2 py-3 text-center">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="font-bold text-gray-900 text-sm mt-0.5">
              {formatVND(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Total interest */}
      <div className="px-4 py-2.5 flex justify-between text-xs text-gray-500 border-b">
        <span>Tổng lãi phải trả</span>
        <span className="font-medium text-red-500">{formatVND(data.total_interest)}</span>
      </div>

      {/* Schedule toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-purple-600 hover:bg-gray-50 transition-colors"
      >
        <span>Lịch trả nợ (6 tháng đầu)</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="px-2 py-1.5 text-left rounded-l">Tháng</th>
                <th className="px-2 py-1.5 text-right">Gốc</th>
                <th className="px-2 py-1.5 text-right">Lãi</th>
                <th className="px-2 py-1.5 text-right rounded-r">Dư nợ</th>
              </tr>
            </thead>
            <tbody>
              {data.schedule.map((row) => (
                <tr key={row.month} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-600">{row.month}</td>
                  <td className="px-2 py-1.5 text-right">{formatVND(row.principal)}</td>
                  <td className="px-2 py-1.5 text-right text-red-400">{formatVND(row.interest)}</td>
                  <td className="px-2 py-1.5 text-right text-gray-600">{formatVND(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Info size={12} className="shrink-0" />
            <span>{data.disclaimer}</span>
          </p>
        </div>
      )}
    </div>
  );
}
