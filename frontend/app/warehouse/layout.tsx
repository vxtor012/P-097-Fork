"use client";

import { BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";

const NAV = [{ href: "/warehouse/dashboard", icon: BarChart3, label: "Tổng quan kho" }];

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Quản lý kho" nav={NAV}>{children}</DashboardShell>;
}
