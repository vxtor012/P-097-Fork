"use client";

import { useState, useEffect } from "react";
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
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editDelivery, setEditDelivery] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) {
        const data = await res.json();
        const mapped: InventoryItem[] = (data.inventory || []).map((i: any) => ({
          id: i.id,
          dealerId: i.dealer_id,
          model: i.model,
          version: i.version,
          color: i.color,
          colorHex: i.color_hex || "#FFFFFF",
          quantity: Number(i.quantity) || 0,
          estDelivery: i.est_delivery || "Giao ngay",
          updatedAt: i.updated_at ? i.updated_at.slice(0, 10) : "Hôm nay",
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const startEdit = (item: InventoryItem) => {
    setEditId(item.id);
    setEditQty(item.quantity);
    setEditDelivery(item.estDelivery);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: editQty,
          est_delivery: editDelivery,
        }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  quantity: editQty,
                  estDelivery: editDelivery,
                  updatedAt: new Date().toISOString().slice(0, 10),
                }
              : x
          )
        );
        setEditId(null);
      } else {
        alert("Cập nhật kho không thành công.");
      }
    } catch (err) {
      console.error("Failed to update inventory:", err);
    } finally {
      setSaving(false);
    }
  };

  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    (acc[item.model] = acc[item.model] || []).push(item);
    return acc;
  }, {});

  const totalCars = items.reduce((s, i) => s + i.quantity, 0);
  const outOfStock = items.filter((i) => i.quantity === 0).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kho xe đại lý (Inventory)</h1>
          <p className="text-slate-500 text-sm mt-1">Tồn kho trực tiếp từ hệ thống quản lý đại lý</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInventory}
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
                      <td className="px-5 py-3 font-semibold text-slate-800">{item.version}</td>
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
                      <td className="px-4 py-3 text-xs text-slate-400">{item.updatedAt}</td>
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
