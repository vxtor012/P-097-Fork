"use client";

import { LayoutDashboard, Tag, Package, Users, FileCheck } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const NAV = [
  { href: "/seller/dashboard", icon: LayoutDashboard, label: "Tổng quan" },
  { href: "/seller/promotions", icon: Tag, label: "Khuyến mãi" },
  { href: "/seller/inventory", icon: Package, label: "Kho xe" },
  { href: "/seller/leads", icon: Users, label: "Khách hàng" },
  { href: "/seller/quotes", icon: FileCheck, label: "Báo giá" },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Kinh doanh" nav={NAV}>{children}</DashboardShell>;
}
