import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "buyer" | "seller" | "warehouse" | "warehouse_manager" | "admin";

export interface AuthUser {
  id:       string;
  name:     string;
  email:    string;
  role:     UserRole;
  dealerId: string | null;
  dealer:   string | null;
  branchId: string | null;
  storeIds: string[] | null;
}

interface AuthState {
  user:   AuthUser | null;
  token:  string | null;
  login:  (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

export const ROLE_HOME: Record<UserRole, string> = {
  buyer:             "/configurator",
  seller:            "/seller/dashboard",
  warehouse:         "/warehouse/dashboard",
  warehouse_manager: "/warehouse/dashboard",
  admin:             "/seller/dashboard",
};

// ── Helper: set/remove cookie ────────────────────────────────
function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:  null,
      token: null,

      login: async (email, password) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return {
              ok: false,
              error: data.detail || "Email hoặc mật khẩu không chính xác",
            };
          }

          const user: AuthUser = data.user;
          const token: string = data.token;

          set({ user, token });

          // Lưu vào cookie để middleware Next.js đọc được
          setCookie("vf-auth", JSON.stringify({ state: { user, token } }));

          return { ok: true };
        } catch (err) {
          console.error("Login request failed:", err);
          return { ok: false, error: "Không thể kết nối tới máy chủ xác thực" };
        }
      },

      logout: () => {
        set({ user: null, token: null });
        removeCookie("vf-auth");
      },
    }),
    {
      name: "vf-auth-storage",
    }
  )
);
