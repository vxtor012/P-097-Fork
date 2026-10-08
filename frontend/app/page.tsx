import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Calculator, Banknote, CalendarCheck, MapPin } from "lucide-react";
import { AuthButton } from "@/components/shared/auth-button";
import { CarImage } from "@/components/shared/car-image";
import { NewsletterForm } from "@/components/landing/newsletter-form";
import { BRAND } from "@/lib/brand";
import { VEHICLES, VehicleKey } from "@/lib/vehicle-data";
import { BRANCHES, STORES } from "@/lib/org-data";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: BRAND.siteTitle };

const TOOLS = [
  { icon: Calculator, title: "Dự toán chi phí lăn bánh", text: "Giá xe, ưu đãi, trước bạ theo tỉnh và phụ kiện.", href: "/configurator" },
  { icon: Bot, title: "Hỏi trợ lý chọn xe", text: "Nói ngân sách và nhu cầu, nhận gợi ý dòng xe phù hợp.", href: "/configurator/customize" },
  { icon: Banknote, title: "Dự toán vay trả góp", text: "So sánh kỳ hạn, và mua pin với thuê pin.", href: "/configurator/customize" },
  { icon: CalendarCheck, title: "Xe có sẵn và lái thử", text: "Xem cửa hàng nào còn xe, có xe lái thử.", href: "/configurator/customize" },
];

export default function Landing() {
  const keys = Object.keys(VEHICLES) as VehicleKey[];
  const featured = VEHICLES[BRAND.featured];

  return (
    <div className="bg-white text-slate-900">
      <div className="bg-blue-600 px-5 py-2 text-center text-sm text-white">
        {BRAND.promoTitle} · <Link href="/configurator/customize" className="font-semibold underline">Xem ưu đãi cho xe của bạn</Link>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="text-lg font-bold tracking-[.3em]">{BRAND.name}</Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#dong-xe" className="hover:text-slate-900">Dòng xe</a>
            <a href="#cong-cu" className="hover:text-slate-900">Công cụ mua xe</a>
            <a href="#uu-dai" className="hover:text-slate-900">Ưu đãi</a>
            <a href="#showroom" className="hover:text-slate-900">Showroom</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/configurator/customize" className="hidden rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold hover:border-slate-900 sm:block">Hỏi trợ lý</Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Banner đầu trang */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1220] to-[#14305e] text-white">
        <span className="pointer-events-none absolute -right-4 top-6 select-none text-[24vw] font-extrabold leading-none text-white/[.05]">{featured.label.replace(" ", "")}</span>
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 py-14 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] md:text-6xl">{BRAND.heroTitle}</h1>
            <p className="mt-5 max-w-lg text-lg text-white/75">{BRAND.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/configurator/customize?model=${BRAND.featured}`} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 font-semibold hover:bg-blue-500">Cấu hình {featured.label} <ArrowRight size={18} /></Link>
              <Link href="/configurator" className="rounded-full border border-white/30 px-7 py-3.5 font-semibold hover:bg-white/10">Xem tất cả dòng xe</Link>
            </div>
          </div>
          <CarImage model={BRAND.featured} colorId={featured.colors[0].id} alt={`${BRAND.name} ${featured.label}`} className="relative drop-shadow-2xl" />
        </div>
      </section>

      {/* Dòng xe */}
      <section id="dong-xe" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16">
        <h2 className="text-3xl font-bold">Dòng xe</h2>
        <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-3">
          {keys.map((k) => {
            const v = VEHICLES[k];
            const from = Math.min(...v.versions.map((x) => x.price));
            return (
              <Link key={k} href={`/configurator/customize?model=${k}`} className="group rounded-3xl bg-slate-50 p-5 transition hover:bg-slate-100">
                <CarImage model={k} colorId={v.colors[0].id} alt={v.label} className="transition group-hover:scale-105" />
                <div className="mt-3 flex items-end justify-between">
                  <div><p className="text-xl font-bold">{v.label}</p><p className="text-sm text-slate-500">Từ {formatNumber(from)}đ</p></div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-blue-600">Cấu hình <ArrowRight size={16} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Ưu đãi */}
      <section id="uu-dai" className="scroll-mt-20 bg-blue-600 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-10 md:flex-row md:items-center">
          <div><p className="text-2xl font-bold">{BRAND.promoTitle}</p><p className="mt-1 text-white/80">{BRAND.promoText}</p></div>
          <Link href="/configurator/customize" className="rounded-full bg-white px-6 py-3 font-semibold text-blue-700">Hỏi trợ lý về ưu đãi</Link>
        </div>
      </section>

      {/* Công cụ mua xe */}
      <section id="cong-cu" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16">
        <h2 className="text-3xl font-bold">Mua xe dễ dàng hơn</h2>
        <p className="mt-2 text-slate-600">Các công cụ giúp bạn chọn xe, tính chi phí và sở hữu xe phù hợp.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ icon: Icon, title, text, href }) => (
            <Link key={title} href={href} className="rounded-3xl border border-slate-200 p-6 transition hover:border-blue-600 hover:shadow-lg">
              <Icon className="text-blue-600" size={28} />
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Showroom */}
      <section id="showroom" className="scroll-mt-20 bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-3xl font-bold">Showroom của {BRAND.dealerName}</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STORES.map((s) => (
              <div key={s.id} className="rounded-3xl bg-white p-6">
                <MapPin className="text-blue-600" size={24} />
                <h3 className="mt-3 font-bold">{s.name}</h3>
                <p className="text-sm text-slate-500">{BRANCHES.find((b) => b.id === s.branchId)?.name}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-slate-600">Hotline đại lý: {BRAND.hotline}. Hỏi trợ lý để biết cửa hàng nào còn đúng màu, đúng phiên bản.</p>
        </div>
      </section>

      {/* Đăng ký nhận thông tin */}
      <section className="bg-[#0b1220] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-12 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-2xl font-bold">Đăng ký nhận thông tin</h2><p className="mt-1 text-white/70">Nhận chương trình khuyến mãi và dịch vụ mới nhất.</p></div>
          <NewsletterForm />
        </div>
      </section>

      <footer className="px-5 py-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p>Giá chỉ mang tính tham khảo. Báo giá chính thức do tư vấn viên của {BRAND.dealerName} xác nhận.</p>
          <p className="flex gap-5"><Link href="/configurator">Cấu hình xe</Link><Link href="/login">Dành cho nhân viên</Link></p>
        </div>
      </footer>
    </div>
  );
}
