import { INVENTORY, InventoryItem } from "@/lib/seller-mock-data";
import type { AuthUser } from "@/lib/auth-store";

// Đại lý → Chi nhánh → Cửa hàng (mock). Khi có backend, thay bằng bảng dealers/branches/stores.
export const BRANCHES = [
  { id: "b1", dealerId: "d1", name: "Chi nhánh Cầu Giấy" },
  { id: "b2", dealerId: "d1", name: "Chi nhánh Long Biên" },
];

export const STORES = [
  { id: "s1", dealerId: "d1", branchId: "b1", name: "Showroom Cầu Giấy" },
  { id: "s2", dealerId: "d1", branchId: "b1", name: "Showroom Mỹ Đình" },
  { id: "s3", dealerId: "d1", branchId: "b2", name: "Showroom Long Biên" },
];

export type StoreItem = InventoryItem & { storeId: string };

// Mock: mỗi cửa hàng có số lượng khác nhau, suy ra từ INVENTORY gốc.
export const STORE_INVENTORY: StoreItem[] = STORES.flatMap((s, si) =>
  INVENTORY.map((it, idx) => ({ ...it, id: `${s.id}-${it.id}`, storeId: s.id, quantity: (it.quantity + si + idx) % 4 }))
);

/** Cửa hàng mà user được phép thấy. Thủ kho: chỉ cửa hàng được gán. Quản lý kho/seller: cả đại lý. */
export function getVisibleStores(user: AuthUser | null) {
  if (!user) return [];
  if (user.role === "warehouse") return STORES.filter((s) => user.storeIds?.includes(s.id)); // thiếu storeIds => không thấy gì
  return STORES.filter((s) => s.dealerId === user.dealerId);
}
