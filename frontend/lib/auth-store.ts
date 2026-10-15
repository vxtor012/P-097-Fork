import { create } from "zustand";
import { getQueryClient } from "@/lib/query-client";

export type UserRole = "buyer" | "seller" | "warehouse" | "warehouse_manager" | "admin";
export interface AuthUser {
  id: string; name: string; email: string; role: UserRole;
  dealerId: string | null; dealer: string | null; branchId: string | null; storeIds: string[] | null;
}
interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
}
export const ROLE_HOME: Record<UserRole, string> = {
  buyer: "/configurator", seller: "/seller/dashboard", warehouse: "/warehouse/dashboard",
  warehouse_manager: "/warehouse/dashboard", admin: "/seller/dashboard",
};
let sessionRevision = 0;
export const useAuthStore = create<AuthState>()((set) => ({
  user: null, initialized: false,
  refreshSession: async () => {
    const revision = sessionRevision;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      if (revision !== sessionRevision) return;
      if (res.ok) set({ user: data.user, initialized: true });
      else if (res.status === 401 || res.status === 403) {
        set({ user: null, initialized: true });
        getQueryClient().clear();
      } else set({ initialized: true });
    } catch { if (revision === sessionRevision) set({ initialized: true }); }
  },
  login: async (email, password) => {
    const revision = ++sessionRevision;
    try {
      const res = await fetch("/api/auth/login", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (revision !== sessionRevision) return { ok: false, error: "Phiên đăng nhập đã thay đổi." };
      if (!res.ok) return { ok: false, error: typeof data.detail === "string" ? data.detail : "Không thể đăng nhập. Vui lòng kiểm tra thông tin." };
      getQueryClient().clear();
      set({ user: data.user, initialized: true });
      return { ok: true };
    } catch { return { ok: false, error: "Không thể kết nối máy chủ đăng nhập." }; }
  },
  logout: async () => {
    ++sessionRevision;
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok && res.status !== 401) return false;
      set({ user: null, initialized: true });
      getQueryClient().clear();
      return true;
    } catch { return false; }
  },
}));
