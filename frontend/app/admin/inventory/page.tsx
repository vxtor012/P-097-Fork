import { InventoryManager } from "@/components/shared/inventory-manager";

export default function AdminInventoryPage() {
  return <InventoryManager title="Tồn kho toàn hệ thống" showStores storeFilterLabel="Lọc theo cửa hàng" />;
}
