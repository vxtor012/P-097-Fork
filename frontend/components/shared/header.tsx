"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, ROLE_HOME } from "@/lib/auth-store";
import { Car, LogIn, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const router         = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen]  = useState(false);
  const ref              = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/configurator");
  };

  const ROLE_LABEL: Record<string, string> = {
    seller:    "Nhân viên kinh doanh",
    warehouse: "Thủ kho",
    warehouse_manager: "Quản lý kho",
    admin:     "Quản trị viên",
  };

  return (
    <header className="h-14 bg-white border-b flex items-center px-6 gap-4 shadow-sm z-50">
      {/* Logo */}
      <Link href="/configurator" className="flex items-center gap-2 font-bold text-gray-900">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Car size={14} className="text-white" />
        </div>
        VinFast AI
      </Link>

      <div className="flex-1" />

      {/* Auth section */}
      {user ? (
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-xs text-gray-500">{ROLE_LABEL[user.role] || user.role}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border p-2 z-50">
              {/* User info */}
              <div className="px-3 py-2 mb-1 border-b">
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
                {user.dealer && (
                  <p className="text-xs text-blue-600 mt-0.5">{user.dealer}</p>
                )}
              </div>

              {/* Go to dashboard */}
              <Link
                href={ROLE_HOME[user.role]}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <LayoutDashboard size={15} /> Dashboard
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors mt-1"
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <LogIn size={15} /> Đăng nhập
        </Link>
      )}
    </header>
  );
}
