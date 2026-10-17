import type { Vehicle, VehicleKey } from "@/lib/vehicle-data";

export interface Province {
  label: string;
  registrationRate: number;
  plateFee: number;
}

export interface CatalogAccessory {
  id: string;
  label: string;
  price: number;
  compatibleModels: string[];
}

export interface Catalog {
  vehicles: Partial<Record<VehicleKey, Vehicle>>;
  provinces: Record<string, Province>;
  accessories: CatalogAccessory[];
  data_source: string;
  fetched_at: string;
  price_versions: string[];
}

export interface DealerOption {
  id: string; name: string; province: string; address: string | null; phone: string | null;
}

export async function fetchDealers({ signal }: { signal?: AbortSignal } = {}): Promise<DealerOption[]> {
  const res = await fetch('/api/dealers', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được danh sách đại lý.');
  return (await res.json()).dealers;
}

export interface ServerPricing {
  pricing_hash: string;
  promotion_decisions: PromotionDecision[];
  battery_options: { buy: boolean; rent: boolean };
  base_price: number;
  battery_cost: number;
  battery_rent: number;
  accessories: { code: string; name: string; price: number }[];
  rolling_costs: { registration_fee: number; road_fee: number; inspection_fee: number; insurance: number; plate_fee: number };
  promotions: { id: string; name: string; value: number; source: string }[];
  total_discount: number;
  final_price: number;
  province: string;
  price_version: string;
  calculated_at: string;
  data_source: string;
  disclaimer: string;
}

export interface PromotionDecision {
  id: string; name: string;
  state: 'verified_applied' | 'eligible_pending_verification' | 'ineligible' | 'data_unavailable';
  applied_to_price: boolean;
  verification_requirements: { attribute: string; accepted_values: string[]; document: string }[];
}

export async function fetchCatalog({ signal }: { signal?: AbortSignal } = {}): Promise<Catalog> {
  const res = await fetch("/api/vehicles", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được danh mục hiện hành.");
  const data: Catalog = await res.json();
  if (!data.vehicles || !Object.keys(data.vehicles).length || !data.provinces || !Array.isArray(data.accessories)) {
    throw new Error("Danh mục hiện hành chưa đầy đủ.");
  }
  for (const vehicle of Object.values(data.vehicles)) {
    if (!vehicle?.versions?.length || !vehicle.colors?.length ||
      vehicle.versions.some((v) => !Number.isFinite(v.price))) {
      throw new Error("Danh mục xe không hợp lệ.");
    }
  }
  return data;
}

export async function readApiError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return typeof data.detail === "string" ? data.detail
    : typeof data.detail?.message === "string" ? data.detail.message : fallback;
}
