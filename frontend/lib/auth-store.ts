import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "buyer" | "seller" | "warehouse" | "warehouse_manager";

export interface AuthUser {
  id:       string;
  name:     string;
  email:    string;
  role:     UserRole;
  dealerId: string | null;
  dealer:   string | null;
  branchId: string | null;
  storeIds: string[] | null; // null = mọi cửa hàng thuộc đại lý
}

interface AuthState {
  user:   AuthUser | null;
  token:  string | null;
  login:  (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const MOCK_USERS: (AuthUser & { password: string })[] = [
  { id: "u1", name: "Nguyễn Văn An", email: "seller@abc.vn", password: "123456", role: "seller",
    dealerId: "d1", dealer: "Đại lý ABC - Hà Nội", branchId: null, storeIds: null },
  { id: "u2", name: "Trần Thị Bình", email: "warehouse@abc.vn", password: "123456", role: "warehouse",
    dealerId: "d1", dealer: "Đại lý ABC - Hà Nội", branchId: "b1", storeIds: ["s1"] },
  { id: "u4", name: "Lê Văn Cường", email: "warehouse2@abc.vn", password: "123456", role: "warehouse",
    dealerId: "d1", dealer: "Đại lý ABC - Hà Nội", branchId: "b2", storeIds: ["s3"] },
  { id: "u5", name: "Phạm Thu Hà", email: "manager@abc.vn", password: "123456", role: "warehouse_manager",
    dealerId: "d1", dealer: "Đại lý ABC - Hà Nội", branchId: null, storeIds: null },
];

export const ROLE_HOME: Record<UserRole, string> = {
  buyer:     "/configurator",
  seller:    "/seller/dashboard",
  warehouse: "/warehouse/dashboard",
  warehouse_manager: "/warehouse/dashboard",
};

// ── Helper: set/remove cookie ────────────────────────────────
function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:  null,
      token: null,

      login: async (email, password) => {
        await new Promise((r) => setTimeout(r, 500)); // giả lập API

        const found = MOCK_USERS.find(
          (u) => u.email === email && u.password === password
        );
        if (!found) {
          return { ok: false, error: "Email hoặc mật khẩu không đúng" };
        }

        const user: AuthUser = {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role,
          dealerId: found.dealerId,
          dealer: found.dealer,
          branchId: found.branchId,
          storeIds: found.storeIds,
        };
        const token = `mock-token-${user.id}-${Date.now()}`;

        set({ user, token });

        // ── Lưu vào cookie để middleware đọc được ──
        setCookie("vf-auth", JSON.stringify({ state: { user, token } }));

        return { ok: true };
      },

      logout: () => {
        set({ user: null, token: null });
        removeCookie("vf-auth");
      },
    }),
    {
      name: "vf-auth-storage", // localStorage key (khác với cookie key)
    }
  )
);
