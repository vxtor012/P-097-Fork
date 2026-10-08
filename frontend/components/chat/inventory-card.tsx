"use client";

import { InventoryData } from "@/types/chat";
import { MapPin, Package, Calendar } from "lucide-react";

export function InventoryCard({ data }: { data: InventoryData }) {
  return (
    <div className="w-80 bg-white rounded-2xl border shadow-md overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3">
        <p className="font-bold flex items-center gap-1.5">
          <Package size={15} />
          <span>Tình trạng kho xe</span>
        </p>
        <p className="text-green-200 text-xs mt-0.5">{data.model}</p>
      </div>

      {/* Dealers */}
      <div className="divide-y">
        {data.dealers.map((dealer, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900 leading-tight">{dealer.name}</p>
              <span
                className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  dealer.est_delivery === "Giao ngay"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {dealer.est_delivery}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{dealer.address}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-gray-600">
                <Package size={11} />
                {dealer.quantity} xe
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">
                {dealer.colors_available.join(", ")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50">
        <button className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
          <Calendar size={13} />
          <span>Đặt lịch lái thử</span>
        </button>
      </div>
    </div>
  );
}
