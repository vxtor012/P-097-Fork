/** Backend response fields shared by the management screens. */
export interface LeadResponse {
  id: string;
  session_id: string;
  name: string | null;
  phone: string | null;
  province: string | null;
  interested_in: string | null;
  budget: number | null;
  status: string;
  created_at: string;
  note?: string;
  assigned_to: string | null;
  dealer_id: string | null;
}

export interface QuoteResponse {
  id: string;
  lead_id?: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  model: string;
  version: string;
  color: string;
  province: string;
  final_price: number;
  price_version: string;
  status: string;
  seller_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  price_snapshot: Record<string, unknown>;
}

export interface InventoryResponse {
  id: string;
  dealer_id: string;
  store_id: string | null;
  model: string;
  version: string;
  color: string;
  color_hex: string;
  quantity: number;
  est_delivery: string | null;
  updated_at: string;
}

export interface PromotionResponse {
  id: string;
  name: string;
  description: string | null;
  model: string;
  province: string | null;
  discount_type: "fixed" | "percent";
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  currently_valid: boolean;
  usage_count: number;
  dealer_id: string | null;
  editable: boolean;
}
