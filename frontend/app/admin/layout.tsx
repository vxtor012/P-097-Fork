"use client";

import { LayoutDashboard, Users, CarFront, Package, CircleDollarSign } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Tổng quan" },
  { href: "/admin/staff", icon: Users, label: "Nhân sự" },
  { href: "/admin/vehicles", icon: CarFront, label: "Danh mục xe" },
  { href: "/admin/inventory", icon: Package, label: "Tồn kho" },
  { href: "/admin/revenue", icon: CircleDollarSign, label: "Doanh thu" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Quản trị hệ thống" nav={NAV}>{children}</DashboardShell>;
}
