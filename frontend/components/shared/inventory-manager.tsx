"use client";

import type { InventoryResponse } from "@/lib/api-types";

import { useState } from "react";
import { useStaffData, apiRequest, refreshStaffData } from "@/hooks/use-staff-data";
import { Pencil, Save, X, AlertTriangle, RefreshCw } from "lucide-react";

export interface InventoryItem {
  id: string;
  dealerId: string;
  model: string;
  version: string;
  color: string;
  colorHex: string;
  quantity: number;
  estDelivery: string;
  updatedAt: string;
  storeId: string | null;
}

export function InventoryManager({ title = "Kho xe đại lý", showStores = false }: { title?: string; showStores?: boolean }) {
  const [storeId, setStoreId] = useState('');
  const query = useStaffData<{ inventory: InventoryResponse[] }>('seller-inventory', '/api/inventory' + (storeId ? '?store_id=' + storeId : ''));
  const storeQuery = useStaffData<{ stores: { id: string; name: string }[] }>('staff-stores', '/api/stores');
  const stores = storeQuery.data?.stores ?? [];
  const items: InventoryItem[] = (query.data?.inventory ?? []).map((i) => ({ id: i.id, dealerId: i.dealer_id,
    storeId: i.store_id, model: i.model, version: i.version, color: i.color, colorHex: i.color_hex || '#FFFFFF',
    quantity: i.quantity, estDelivery: i.est_delivery ?? 'Chưa xác định', updatedAt: i.updated_at }));
  const loading = query.isPending;
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editDelivery, setEditDelivery] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const startEdit = (item: InventoryItem) => { setEditId(item.id); setEditQty(item.quantity);
    setEditDelivery(item.estDelivery); setEditVersion(item.updatedAt); setActionError(''); };
  const saveEdit = async (id: string) => {
    if (saving) return;
    setSaving(true); setActionError('');
    try {
      await apiRequest('/api/inventory/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: editQty, est_delivery: editDelivery, expected_updated_at: editVersion }) });
      await refreshStaffData(); setEditId(null);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Không cập nhật được kho.'); await query.refetch(); }
    finally { setSaving(false); }
  };

  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    (acc[item.model] = acc[item.model] || []).push(item);
    return acc;
  }, {});

  const totalCars = items.reduce((s, i) => s + i.quantity, 0);
  const outOfStock = items.filter((i) => i.quantity === 0).length;

  return (
    <div className="p-6 space-y-6">
      {(query.error || storeQuery.error || actionError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError || query.error?.message || storeQuery.error?.message}</p>}
      {showStores && <label className="block text-sm text-slate-600">Cửa hàng được phân quyền
        <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setEditId(null); }} className="ml-3 rounded-xl border p-2">
          <option value="">Tất cả trong phạm vi tài khoản</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </label>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-500 text-sm mt-1">Tồn kho trực tiếp từ hệ thống quản lý đại lý</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => query.refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
          <div className="bg-white border rounded-xl px-4 py-2 text-center shadow-sm">
            <p className="text-xs text-slate-500">Tổng xe</p>
            <p className="font-bold text-blue-600 text-lg">{totalCars}</p>
          </div>
          {outOfStock > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center shadow-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <div>
                <p className="text-xs text-red-500">Hết hàng</p>
                <p className="font-bold text-red-600 text-lg">{outOfStock}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Đang tải danh sách tồn kho từ database...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Chưa có dữ liệu tồn kho</div>
      ) : (
        /* Table theo model */
        Object.entries(grouped).map(([model, modelItems]) => (
          <div key={model} className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-base">VinFast {model}</h2>
              <span className="text-xs font-medium text-slate-500 bg-white border px-2.5 py-1 rounded-full shadow-2xs">
                {modelItems.reduce((s, i) => s + i.quantity, 0)} xe có sẵn
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b bg-white">
                    <th className="px-5 py-3 text-left">Phiên bản</th>
                    <th className="px-4 py-3 text-left">Màu sắc</th>
                    <th className="px-4 py-3 text-center">Số lượng</th>
                    <th className="px-4 py-3 text-left">Thời gian giao</th>
                    <th className="px-4 py-3 text-left">Cập nhật</th>
                    <th className="px-4 py-3 text-center">Sửa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {modelItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        item.quantity === 0 ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-semibold text-slate-800">{item.version}<p className="text-xs text-slate-400">{stores.find((s) => s.id === item.storeId)?.name ?? "Kho cấp đại lý"}</p></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: item.colorHex }}
                          />
                          <span className="text-slate-700">{item.color}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editId === item.id ? (
                          <input
                            type="number"
                            min={0}
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value))}
                            className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        ) : (
                          <span
                            className={`font-bold ${
                              item.quantity === 0
                                ? "text-red-600"
                                : item.quantity <= 1
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {item.quantity === 0 ? "Hết hàng" : item.quantity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editId === item.id ? (
                          <input
                            value={editDelivery}
                            onChange={(e) => setEditDelivery(e.target.value)}
                            className="w-32 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        ) : (
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              item.estDelivery === "Giao ngay"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.estDelivery}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(item.updatedAt + (item.updatedAt.endsWith("Z") ? "" : "Z")).toLocaleString("vi-VN")}</td>
                      <td className="px-4 py-3 text-center">
                        {editId === item.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              disabled={saving}
                              onClick={() => saveEdit(item.id)}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                              title="Lưu"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                              title="Huỷ"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors mx-auto block"
                            title="Sửa số lượng / ngày giao"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
