export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  data?: StructuredData;
}

export type StructuredData =
  | PriceQuoteData
  | InstallmentData
  | InventoryData
  | ComparisonData
  | CarInfoData;

export interface PriceQuoteData {
  type: "price_quote";
  model: string;
  version: string;
  color: string;
  base_price: number;
  battery_option: "buy" | "rent";
  battery_cost: number;
  accessories: { name: string; price: number }[];
  promotions: { name: string; value: number; source: string }[];
  rolling_costs: {
    registration_fee: number;
    road_fee: number;
    inspection_fee: number;
    insurance: number;
    plate_fee: number;
  };
  total_discount: number;
  final_price: number;
  province: string;
  price_version: string;
  disclaimer: string;
}

export interface InstallmentData {
  type: "installment";
  total_price: number;
  down_payment: number;
  down_payment_pct: number;
  loan_amount: number;
  bank: string;
  term_months: number;
  interest_rate: number;
  monthly_payment: number;
  total_interest: number;
  total_paid: number;
  schedule: {
    month: number;
    principal: number;
    interest: number;
    monthly_total: number;
    balance: number;
  }[];
  disclaimer: string;
}

export interface InventoryData {
  type: "inventory";
  model: string;
  dealers: {
    name: string;
    address: string;
    province: string;
    colors_available: string[];
    quantity: number;
    est_delivery: string;
  }[];
}

export interface ComparisonData {
  type: "comparison";
  vehicles: {
    model: string;
    version: string;
    price: number;
    specs: Record<string, string>;
    promotions: number;
  }[];
}

export interface CarInfoData {
  type: "car_info";
  model: string;
  image_url?: string;
  specs: Record<string, string>;
  versions: { name: string; price: number }[];
}

export interface Quote {
  id: string;
  status: "pending" | "approved" | "rejected";
  price_snapshot: PriceQuoteData;
  created_at: string;
}
