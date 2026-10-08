"use client";

import { useState } from "react";
import { Package, AlertTriangle, TrendingUp, Store } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { STORE_INVENTORY, getVisibleStores } from "@/lib/org-data";

export default function WarehouseDashboard() {
  const user = useAuthStore((s) => s.user);
  const [picked, setPicked] = useState("all");
  const stores = getVisibleStores(user);
  if (!user) return null;
  if (stores.length === 0) {
    return <p className="p-6 text-gray-500">Tài khoản chưa được gán cửa hàng nào. Hãy liên hệ quản lý để được cấp quyền.</p>;
  }

  const active = stores.some((s) => s.id === picked) ? picked : "all";
  const scoped = stores.filter((s) => active === "all" || s.id === active);
  const items = STORE_INVENTORY.filter((i) => scoped.some((s) => s.id === i.storeId));
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const out = items.filter((i) => i.quantity === 0);
  const low = items.filter((i) => i.quantity === 1);
  const total = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan kho xe</h1>
          <p className="mt-1 text-sm text-gray-500">{user.dealer ?? "VinFast"} · {user.role === "warehouse" ? "Thủ kho cửa hàng" : "Quản lý kho"}</p>
        </div>
        {stores.length > 1 ? (
          <select value={active} onChange={(e) => setPicked(e.target.value)} className="rounded-xl border bg-white px-4 py-2 text-sm">
            <option value="all">Tất cả cửa hàng ({stores.length})</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <span className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm"><Store size={16} />{stores[0].name}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: <Package size={20} className="text-blue-600" />, label: "Tổng xe tồn kho", value: total },
          { icon: <AlertTriangle size={20} className="text-red-500" />, label: "Hết hàng", value: out.length },
          { icon: <TrendingUp size={20} className="text-yellow-600" />, label: "Sắp hết (còn 1 xe)", value: low.length },
          { icon: <Store size={20} className="text-green-600" />, label: "Cửa hàng đang xem", value: scoped.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">{s.icon}</div>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">Tồn kho theo cửa hàng</h2></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3 text-left">Cửa hàng</th>
              <th className="px-4 py-3 text-center">Tổng xe</th>
              <th className="px-4 py-3 text-center">Sắp hết</th>
              <th className="px-4 py-3 text-center">Hết hàng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {scoped.map((s) => {
              const rows = STORE_INVENTORY.filter((i) => i.storeId === s.id);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">{rows.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="px-4 py-3 text-center">{rows.filter((i) => i.quantity === 1).length || "—"}</td>
                  <td className="px-4 py-3 text-center">{rows.filter((i) => i.quantity === 0).length || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {out.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-700"><AlertTriangle size={16} /> Xe hết hàng cần nhập</h3>
          <div className="space-y-2">
            {out.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: i.colorHex }} />
                  {i.model} {i.version} · {i.color}
                </span>
                <span className="text-xs text-gray-500">{nameOf(i.storeId)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
