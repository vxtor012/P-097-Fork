"use client";

import Link from "next/link";
import { ArrowRight, CarFront, CircleDollarSign, Package, Users } from "lucide-react";
import { useStaffData } from "@/hooks/use-staff-data";

type Staff = { id: string; role: string; is_active: boolean };
type Catalog = { vehicles: Record<string, { label: string; versions: { id: string; price: number }[] }> };
type Inventory = { inventory: { quantity: number }[] };
type Revenue = { summary: { estimated_value: number; closed_leads: number } };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function AdminDashboard() {
  const staff = useStaffData<{ staff: Staff[] }>("admin-staff", "/api/admin/staff");
  const catalog = useStaffData<Catalog>("admin-catalog", "/api/vehicles");
  const inventory = useStaffData<Inventory>("admin-inventory", "/api/inventory");
  const revenue = useStaffData<Revenue>("admin-revenue", "/api/admin/revenue");
  const people = staff.data?.staff ?? [];
  const models = Object.values(catalog.data?.vehicles ?? {});
  const cars = (inventory.data?.inventory ?? []).reduce((sum, row) => sum + row.quantity, 0);
  const cards = [
    { label: "Nhân viên", value: people.length, detail: `${people.filter((person) => person.is_active).length} tài khoản đang hoạt động`, icon: Users, href: "/admin/staff", tone: "bg-emerald-50 text-emerald-700" },
    { label: "Dòng xe", value: models.length, detail: `${models.reduce((sum, model) => sum + model.versions.length, 0)} phiên bản`, icon: CarFront, href: "/admin/vehicles", tone: "bg-blue-50 text-blue-700" },
    { label: "Xe trong kho", value: new Intl.NumberFormat("vi-VN").format(cars), detail: "Tổng tồn kho các đại lý", icon: Package, href: "/admin/inventory", tone: "bg-amber-50 text-amber-700" },
    { label: "Giá xe", value: models.length ? money(Math.min(...models.flatMap((model) => model.versions.map((version) => version.price)))) : "—", detail: "Giá khởi điểm hiện hành", icon: CircleDollarSign, href: "/admin/vehicles", tone: "bg-violet-50 text-violet-700" },
    { label: "Giá trị chốt ước tính", value: revenue.data ? money(revenue.data.summary.estimated_value) : "—", detail: `${revenue.data?.summary.closed_leads ?? 0} khách đã chốt`, icon: CircleDollarSign, href: "/admin/revenue", tone: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="space-y-8 p-6 lg:p-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Tổng quan hệ thống</h1>
          <p className="mt-2 text-sm text-slate-500">Quản lý nhân sự, danh mục xe và hoạt động tại các đại lý.</p>
        </div>
        <Link href="/admin/staff" className="inline-flex items-center gap-2 rounded-xl bg-[#134c40] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f3d34]">
          Tạo tài khoản nhân viên <ArrowRight size={16} />
        </Link>
      </header>

      {(staff.error || catalog.error || inventory.error || revenue.error) && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{staff.error?.message || catalog.error?.message || inventory.error?.message || revenue.error?.message}. Một số chỉ số chưa tải được.</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map(({ label, value, detail, icon: Icon, href, tone }) => (
          <Link key={label} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{staff.isPending && label === "Nhân viên" ? "…" : value}</p></div><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span></div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Quản trị nhanh</h2><p className="mt-1 text-sm text-slate-500">Các khu vực cần dùng thường xuyên</p></div></div>
          <div className="mt-5 divide-y divide-slate-100">
            <QuickLink href="/admin/staff" icon={Users} title="Tài khoản nhân viên" detail="Tạo tài khoản, gán vai trò và phạm vi cửa hàng" />
            <QuickLink href="/admin/vehicles" icon={CarFront} title="Danh mục xe và giá" detail="Xem các dòng xe, phiên bản và mức giá đang áp dụng" />
            <QuickLink href="/admin/inventory" icon={Package} title="Tồn kho đại lý" detail="Theo dõi số lượng xe theo phiên bản và màu sắc" />
            <QuickLink href="/admin/revenue" icon={CircleDollarSign} title="Doanh thu ước tính" detail="Tổng hợp giá trị báo giá của các khách đã chốt" />
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-950 p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-300">Phân quyền</p>
          <h2 className="mt-3 text-xl font-semibold">Mỗi nhóm đúng phạm vi công việc</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-100/75">Seller phụ trách khách hàng và báo giá. Thủ kho chỉ cập nhật các cửa hàng được gán. Quản lý kho xem tồn kho trong đại lý.</p>
          <Link href="/admin/staff" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-emerald-200">Quản lý nhân sự <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, detail }: { href: string; icon: React.ComponentType<{ size?: number }>; title: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-4 py-4 first:pt-2 last:pb-1"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span><ArrowRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" /></Link>;
}
