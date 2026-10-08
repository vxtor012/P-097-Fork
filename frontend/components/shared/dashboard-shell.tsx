"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export interface NavItem { href: string; label: string; icon: React.ComponentType<{ size?: number }> }

const ROLE_LABEL: Record<string, string> = {
  seller: "Nhân viên kinh doanh", warehouse: "Thủ kho", warehouse_manager: "Quản lý kho", admin: "Quản trị viên",
};

export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const item = (active: boolean) => cn("flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition", active ? "bg-blue-600 text-white" : "text-white/70 hover:bg-white/10 hover:text-white");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 md:flex-row">
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0b1220] text-white md:flex">
        <div className="px-6 py-6">
          <p className="text-lg font-bold tracking-[.3em]">{BRAND.name}</p>
          <p className="mt-1 text-xs text-white/50">{title}{user?.dealer ? ` · ${user.dealer}` : ""}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className={item(pathname === href)}><Icon size={18} />{label}</Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-3">
          {user && (
            <div className="mb-2 rounded-2xl bg-white/5 px-4 py-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/50">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
          )}
          <Link href="/" className={item(false)}><Home size={18} />Về trang chủ</Link>
          <button onClick={() => { logout(); router.push("/"); }} className={cn(item(false), "w-full text-red-300 hover:text-red-200")}><LogOut size={18} />Đăng xuất</button>
        </div>
      </aside>
      <div className="flex gap-2 overflow-x-auto bg-[#0b1220] p-3 md:hidden">
        {nav.map(({ href, label }) => (
          <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm", pathname === href ? "bg-blue-600 text-white" : "bg-white/10 text-white/80")}>{label}</Link>
        ))}
      </div>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
