"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore, ROLE_HOME } from "@/lib/auth-store";
import { CarImage } from "@/components/shared/car-image";

const DEMO = [
  { label: "Nhân viên kinh doanh", email: "seller@abc.vn", pw: "123456" },
  { label: "Thủ kho · Showroom Cầu Giấy", email: "warehouse@abc.vn", pw: "123456" },
  { label: "Thủ kho · Showroom Long Biên", email: "warehouse2@abc.vn", pw: "123456" },
  { label: "Quản lý kho đại lý", email: "manager@abc.vn", pw: "123456" },
];
const SAFE_FROM = ["/seller/dashboard", "/warehouse/dashboard"];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { login, logout, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sp.get("error") === "unauthorized" ? "Tài khoản này không có quyền vào trang bạn chọn." : "");

  useEffect(() => {
    if (!user) return;
    const from = sp.get("from");
    // Nếu bị chặn vì sai quyền thì về trang của chính vai trò đó, tránh vòng lặp chuyển hướng
    const home = ROLE_HOME[user.role];
    if (!home) { logout(); return; } // phiên đăng nhập cũ có vai trò không còn tồn tại
    router.replace(from && !sp.get("error") && SAFE_FROM.includes(from) ? from : home);
  }, [user, router, sp, logout]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (!r.ok) setError(r.error ?? "Đăng nhập thất bại");
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0b1220] p-12 text-white lg:flex">
        <Link href="/" className="text-lg font-bold tracking-[.3em]">{BRAND.name}</Link>
        <span className="pointer-events-none absolute -right-4 top-24 select-none text-[16vw] font-extrabold leading-none text-white/[.04]">VF8</span>
        <CarImage model="VF8" colorId="white" alt="VinFast VF 8" maxWidth={640} className="relative drop-shadow-2xl" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Cổng làm việc dành cho đại lý</h2>
          <p className="mt-2 max-w-sm text-white/60">Quản lý khuyến mãi, khách hàng, báo giá và tồn kho theo từng cửa hàng.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 block text-lg font-bold tracking-[.3em] text-slate-900 lg:hidden">{BRAND.name}</Link>
          <h1 className="text-3xl font-bold text-slate-900">Đăng nhập</h1>
          <p className="mt-1 text-slate-500">Dành cho nhân viên đại lý. Khách hàng không cần đăng nhập.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-blue-600" />
            <div className="relative">
              <input type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 pr-12 outline-none focus:border-blue-600" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {loading && <Loader2 size={18} className="animate-spin" />}Đăng nhập
            </button>
          </form>

          <div className="mt-10">
            <p className="text-sm font-medium text-slate-500">Tài khoản demo (bấm để điền sẵn)</p>
            <div className="mt-3 grid gap-2">
              {DEMO.map((d) => (
                <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(d.pw); setError(""); }}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-blue-600">
                  <span className="font-medium text-slate-800">{d.label}</span><span className="text-slate-400">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
