// ── STATS ─────────────────────────────────────────────────────
export const DASHBOARD_STATS = {
  totalLeads:      142,
  leadsThisWeek:   23,
  pendingQuotes:   8,
  approvedQuotes:  34,
  totalRevenue:    28500000000,
  revenueThisMonth:4200000000,
  conversionRate:  24,
  topModel:        "VF6",
};

// ── CHART DATA ─────────────────────────────────────────────────
export const WEEKLY_LEADS = [
  { day: "T2", leads: 12, quotes: 3 },
  { day: "T3", leads: 18, quotes: 5 },
  { day: "T4", leads: 9,  quotes: 2 },
  { day: "T5", leads: 24, quotes: 8 },
  { day: "T6", leads: 31, quotes: 10},
  { day: "T7", leads: 15, quotes: 4 },
  { day: "CN", leads: 7,  quotes: 1 },
];

export const MODEL_INTEREST = [
  { model: "VF6",  count: 54, color: "#3B82F6" },
  { model: "VF7",  count: 38, color: "#8B5CF6" },
  { model: "VF5",  count: 27, color: "#10B981" },
  { model: "VF8",  count: 15, color: "#F59E0B" },
  { model: "VF9",  count: 8,  color: "#EF4444" },
];

// ── PROMOTIONS ─────────────────────────────────────────────────
export interface Promotion {
  id:             string;
  name:           string;
  model:          string;
  province:       string | null;
  discountType:   "fixed" | "percent";
  discountValue:  number;
  startDate:      string;
  endDate:        string;
  isActive:       boolean;
  usageCount:     number;
  description:    string;
}

export const PROMOTIONS: Promotion[] = [
  {
    id: "p1",
    name: "Ưu đãi tháng 10 - VF6",
    model: "VF6",
    province: null,
    discountType: "fixed",
    discountValue: 30000000,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    isActive: true,
    usageCount: 47,
    description: "Giảm 30 triệu cho tất cả phiên bản VF6 trong tháng 10",
  },
  {
    id: "p2",
    name: "Tặng gói sạc 1 năm - Đại lý ABC",
    model: "ALL",
    province: "Hà Nội",
    discountType: "fixed",
    discountValue: 5000000,
    startDate: "2026-10-01",
    endDate: "2026-12-31",
    isActive: true,
    usageCount: 21,
    description: "Tặng gói sạc tại nhà 1 năm cho khách mua xe tại đại lý ABC",
  },
  {
    id: "p3",
    name: "Giảm 5% VF7 tháng 9",
    model: "VF7",
    province: null,
    discountType: "percent",
    discountValue: 5,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    isActive: false,
    usageCount: 12,
    description: "Đã hết hạn",
  },
];

// ── INVENTORY ─────────────────────────────────────────────────
export interface InventoryItem {
  id:          string;
  model:       string;
  version:     string;
  color:       string;
  colorHex:    string;
  quantity:    number;
  estDelivery: string;
  updatedAt:   string;
}

export const INVENTORY: InventoryItem[] = [
  { id:"i1", model:"VF6", version:"Plus",        color:"Trắng Tinh Khôi", colorHex:"#FFFFFF", quantity:3, estDelivery:"Giao ngay",  updatedAt:"2026-10-01" },
  { id:"i2", model:"VF6", version:"Plus",        color:"Đen Huyền Bí",   colorHex:"#1a1a1a", quantity:1, estDelivery:"Giao ngay",  updatedAt:"2026-10-01" },
  { id:"i3", model:"VF6", version:"Tiêu chuẩn", color:"Xanh Cổng Trời", colorHex:"#4A90D9", quantity:2, estDelivery:"3-5 ngày",   updatedAt:"2026-10-01" },
  { id:"i4", model:"VF7", version:"Plus",        color:"Trắng Tinh Khôi", colorHex:"#FFFFFF", quantity:0, estDelivery:"2-3 tuần",   updatedAt:"2026-09-30" },
  { id:"i5", model:"VF7", version:"Tiêu chuẩn", color:"Xám Tinh Tế",    colorHex:"#5F6363", quantity:2, estDelivery:"Giao ngay",  updatedAt:"2026-10-01" },
  { id:"i6", model:"VF5", version:"Plus",        color:"Đỏ Rực Rỡ",     colorHex:"#C0392B", quantity:4, estDelivery:"Giao ngay",  updatedAt:"2026-10-02" },
  { id:"i7", model:"VF8", version:"Plus",        color:"Đen Huyền Bí",   colorHex:"#1a1a1a", quantity:1, estDelivery:"1 tuần",     updatedAt:"2026-09-28" },
];

// ── LEADS ─────────────────────────────────────────────────────
export interface Lead {
  id:          string;
  name:        string;
  phone:       string;
  interestedIn:string;
  province:    string;
  status:      "new" | "contacted" | "quoted" | "closed_won" | "closed_lost";
  budget:      number;
  createdAt:   string;
  lastMessage: string;
  messageCount:number;
}

export const LEADS: Lead[] = [
  { id:"l1", name:"Nguyễn Văn An",    phone:"0912345678", interestedIn:"VF6 Plus",        province:"Hà Nội",          status:"quoted",       budget:800000000,  createdAt:"2026-10-02 09:15", lastMessage:"Tôi muốn xuất báo giá chính thức",            messageCount:12 },
  { id:"l2", name:"Trần Thị Bình",    phone:"0987654321", interestedIn:"VF7 Plus",        province:"TP. Hồ Chí Minh", status:"new",           budget:950000000,  createdAt:"2026-10-02 08:30", lastMessage:"So sánh VF7 và VF8 giúp tôi",                 messageCount:5  },
  { id:"l3", name:"Lê Văn Cường",     phone:"0901234567", interestedIn:"VF5 Tiêu chuẩn", province:"Đà Nẵng",         status:"contacted",    budget:500000000,  createdAt:"2026-10-01 15:45", lastMessage:"Tính trả góp 60 tháng qua VPBank",            messageCount:8  },
  { id:"l4", name:"Phạm Thị Dung",    phone:"0934567890", interestedIn:"VF6 Plus",        province:"Hà Nội",          status:"closed_won",   budget:750000000,  createdAt:"2026-09-30 10:00", lastMessage:"Ok tôi đặt cọc rồi, cảm ơn bạn",             messageCount:24 },
  { id:"l5", name:"Hoàng Minh Đức",   phone:"0945678901", interestedIn:"VF8 Plus",        province:"Hải Phòng",       status:"closed_lost",  budget:1100000000, createdAt:"2026-09-29 14:20", lastMessage:"Tôi sẽ cân nhắc thêm",                        messageCount:6  },
  { id:"l6", name:"Vũ Thị Hoa",       phone:"0956789012", interestedIn:"VF7 Tiêu chuẩn", province:"Hà Nội",          status:"new",           budget:850000000,  createdAt:"2026-10-02 10:05", lastMessage:"Xe màu xanh có không?",                       messageCount:3  },
  { id:"l7", name:"Đặng Văn Hùng",    phone:"0967890123", interestedIn:"VF6 Tiêu chuẩn", province:"Hà Nội",          status:"quoted",       budget:680000000,  createdAt:"2026-10-01 11:30", lastMessage:"Gửi tôi báo giá PDF được không?",             messageCount:15 },
];

// ── QUOTES ─────────────────────────────────────────────────────
export interface QuoteItem {
  id:          string;
  leadName:    string;
  leadPhone:   string;
  model:       string;
  version:     string;
  province:    string;
  finalPrice:  number;
  priceVersion:string;
  status:      "pending" | "approved" | "rejected";
  createdAt:   string;
  reviewedAt:  string | null;
  sellerNote:  string | null;
  config: {
    color:      string;
    battery:    string;
    accessories:string[];
    promos:     string[];
  };
}

export const QUOTES: QuoteItem[] = [
  {
    id:"q1", leadName:"Nguyễn Văn An", leadPhone:"0912345678",
    model:"VF6", version:"Plus", province:"Hà Nội",
    finalPrice:700885000, priceVersion:"2025-Q4-v1",
    status:"pending", createdAt:"2026-10-02 09:30", reviewedAt:null, sellerNote:null,
    config:{ color:"Trắng Tinh Khôi", battery:"Mua pin", accessories:["Phim PPF","Camera 360°"], promos:["Ưu đãi tháng 10 - VF6"] },
  },
  {
    id:"q2", leadName:"Đặng Văn Hùng", leadPhone:"0967890123",
    model:"VF6", version:"Tiêu chuẩn", province:"Hà Nội",
    finalPrice:645000000, priceVersion:"2025-Q4-v1",
    status:"pending", createdAt:"2026-10-01 14:00", reviewedAt:null, sellerNote:null,
    config:{ color:"Đen Huyền Bí", battery:"Thuê pin", accessories:["Camera hành trình"], promos:["Ưu đãi tháng 10 - VF6"] },
  },
  {
    id:"q3", leadName:"Phạm Thị Dung", leadPhone:"0934567890",
    model:"VF6", version:"Plus", province:"Hà Nội",
    finalPrice:695000000, priceVersion:"2025-Q4-v1",
    status:"approved", createdAt:"2026-09-30 10:30", reviewedAt:"2026-09-30 11:00", sellerNote:"Khách đã đặt cọc 50tr",
    config:{ color:"Xanh Cổng Trời", battery:"Mua pin", accessories:[], promos:["Ưu đãi tháng 10 - VF6","Tặng gói sạc"] },
  },
  {
    id:"q4", leadName:"Hoàng Minh Đức", leadPhone:"0945678901",
    model:"VF8", version:"Plus", province:"Hải Phòng",
    finalPrice:1085000000, priceVersion:"2025-Q4-v1",
    status:"rejected", createdAt:"2026-09-29 15:00", reviewedAt:"2026-09-29 16:00", sellerNote:"Khách chưa quyết định, hẹn tháng sau",
    config:{ color:"Đen Huyền Bí", battery:"Mua pin", accessories:["Phim PPF","Camera 360°","Thảm 3D"], promos:[] },
  },
];
