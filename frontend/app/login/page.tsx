"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuthStore, ROLE_HOME } from "@/lib/auth-store";
import { BRAND } from "@/lib/brand";
import { CarImage } from "@/components/shared/car-image";

const DEMO = [
  {
    label: "Admin",
    email: "admin@vinfast.vn",
    pw: "AQ-iV4T4znx4CyNqxWz",
  },
  {
    label: "Kinh doanh · Mỹ Đình",
    email: "seller.mydinh@vinfast.vn",
    pw: "AQ-H3Ke9I2e8XvAO8Xu",
  },
  {
    label: "Kinh doanh · Quận 7",
    email: "seller.q7@vinfast.vn",
    pw: "AQ-R2M5w_u-UBV1NReZ",
  },
  {
    label: "Kinh doanh · Đà Nẵng",
    email: "seller.danang@vinfast.vn",
    pw: "AQ-p7r4YSjXRyUlvb56",
  },
  {
    label: "Thủ kho · Mỹ Đình",
    email: "warehouse@vinfast.vn",
    pw: "AQ-pcCOkvXeEn-b9e2z",
  },
];

const SAFE_FROM = [
  "/seller/dashboard",
  "/seller/leads",
  "/seller/quotes",
  "/seller/zalo",
  "/seller/promotions",
  "/seller/inventory",
  "/warehouse/dashboard",
  "/admin",
  "/admin/staff",
  "/admin/vehicles",
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { login, logout, user } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    sp.get("error") === "unauthorized"
      ? "Tài khoản này không có quyền vào trang bạn chọn."
      : ""
  );

  useEffect(() => {
    if (!user) return;

    const from = sp.get("from");
    const home = ROLE_HOME[user.role];

    if (!home) {
      logout();
      return;
    }

    const roleAllowsFrom =
      user.role === "admin" ||
      (user.role === "seller" && from?.startsWith("/seller/")) ||
      (["warehouse", "warehouse_manager"].includes(user.role) &&
        from?.startsWith("/warehouse/"));

    router.replace(
      from &&
        !sp.get("error") &&
        roleAllowsFrom &&
        SAFE_FROM.includes(from)
        ? from
        : home
    );
  }, [user, router, sp, logout]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    const result = await login(email, password);

    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Đăng nhập thất bại");
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#172a27]">
      <header className="flex h-[72px] items-center justify-between border-b border-[#172a27]/10 px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label={`${BRAND.name} — Trang chủ`}
          className="flex items-center gap-2.5 text-[#134c40]"
        >
          <svg
            width="31"
            height="28"
            viewBox="0 0 31 28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 4L15.5 12L29 4L15.5 25L2 4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M2 4L15.5 18L29 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-base font-bold tracking-[.2em]">
            {BRAND.name}
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#577267] transition hover:text-[#134c40]"
        >
          Về trang chủ
          <ArrowUpRight size={15} />
        </Link>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] lg:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden px-12 py-12 lg:flex xl:px-20">
          <div className="pointer-events-none absolute -right-20 top-20 h-[460px] w-[460px] rounded-full bg-[#dce8ce]/70 blur-3xl" />
          <div className="pointer-events-none absolute bottom-10 left-10 h-[300px] w-[300px] rounded-full bg-[#e8eee3] blur-3xl" />

          <div className="relative">
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[.16em] text-[#577267]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#458e73]" />
              KHÔNG GIAN LÀM VIỆC ĐẠI LÝ
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-medium leading-tight tracking-[-.045em] text-[#172a27] xl:text-5xl">
              Cùng khách hàng
              <br />
              <span className="text-[#427660]">mở lối hành trình mới.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#69756d]">
              Quản lý khách hàng, báo giá, khuyến mãi và tồn kho trong cùng
              một không gian làm việc.
            </p>
          </div>

          <div className="relative mx-auto my-8 w-full max-w-[600px]">
            <div className="absolute inset-8 rounded-full bg-[radial-gradient(ellipse_at_center,#dce7dc_0%,#e8ede2_48%,transparent_72%)]" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(120px,18vw,230px)] font-bold leading-none tracking-[-.08em] text-[#5f8c72]/10">
              VF8
            </span>
            <CarImage
              model="VF8"
              colorId="white"
              alt="VinFast VF 8"
              maxWidth={620}
              className="relative drop-shadow-[0_28px_18px_rgba(30,60,50,0.14)]"
            />
          </div>

          <div className="relative flex items-center gap-3 border-t border-[#172a27]/10 pt-5 text-sm text-[#577267]">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#134c40]/15 bg-white">
              <ShieldCheck size={17} />
            </span>
            <span>Đăng nhập bằng tài khoản nhân viên được cấp.</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md rounded-2xl border border-[#172a27]/10 bg-[#fdfcf8] p-6 shadow-[0_20px_60px_rgba(23,42,39,0.07)] sm:p-9">
            <div className="mb-8 lg:hidden">
              <p className="text-[10px] font-semibold tracking-[.16em] text-[#577267]">
                CỔNG LÀM VIỆC DÀNH CHO ĐẠI LÝ
              </p>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#577267]">
              Chào mừng bạn trở lại
            </p>
            <h2 className="mt-2 text-3xl font-medium tracking-[-.04em] text-[#172a27]">
              Đăng nhập
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#69756d]">
              Dành cho nhân viên đại lý. Khách hàng không cần đăng nhập.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#315548]">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="username"
                  className="w-full rounded-lg border border-[#172a27]/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#458e73] focus:ring-2 focus:ring-[#458e73]/15"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#315548]">
                  Mật khẩu
                </span>
                <span className="relative block">
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-[#172a27]/15 bg-white px-4 py-3.5 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#458e73] focus:ring-2 focus:ring-[#458e73]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((value) => !value)}
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#789087] transition hover:bg-[#eff4ed] hover:text-[#134c40]"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#134c40] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1f6352] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Đăng nhập
              </button>
            </form>

            {(process.env.NODE_ENV !== "production" ||
              process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === "true") && (
                <div className="mt-8 border-t border-[#172a27]/10 pt-6">
                  <p className="text-sm font-medium text-[#577267]">
                    Tài khoản demo{" "}
                    <span className="font-normal text-[#89968e]">
                      · bấm để điền sẵn
                    </span>
                  </p>

                  <div className="mt-3 grid w-full min-w-0 gap-2">
                    {DEMO.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => {
                          setEmail(account.email);
                          setPassword(account.pw);
                          setError("");
                        }}
                        className="grid w-full min-w-0 grid-cols-1 items-center gap-1 overflow-hidden rounded-lg border border-[#172a27]/10 bg-white px-3.5 py-3 text-left transition hover:border-[#458e73]/50 hover:bg-[#eff4ed]/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-3"
                      >
                        <span className="block min-w-0 truncate text-sm font-medium text-[#315548]">
                          {account.label}
                        </span>
                        <span
                          title={account.email}
                          className="block min-w-0 truncate text-xs text-[#89968e] sm:text-right"
                        >
                          {account.email}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
