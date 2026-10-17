"use client";

import { useMemo, useState } from "react";
import { CarFront, Search, BatteryCharging, PackageCheck, Info } from "lucide-react";
import { useStaffData } from "@/hooks/use-staff-data";

type Version = { id: string; label: string; price: number; colorPrices?: Record<string, number> };
type Color = { id: string; label: string; hex: string };
type Vehicle = { label: string; image: string; versions: Version[]; colors: Color[]; battery: { buy: number; rent: number } };
type Catalog = { vehicles: Record<string, Vehicle>; accessories: { id: string; label: string; price: number; compatibleModels: string[] }[]; price_versions: string[]; fetched_at: string };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function AdminVehiclesPage() {
  const query = useStaffData<Catalog>("admin-catalog", "/api/vehicles");
  const [search, setSearch] = useState("");
  const catalog = query.data;
  const vehicles = useMemo(() => Object.entries(catalog?.vehicles ?? {}).filter(([key, value]) => `${key} ${value.label}`.toLowerCase().includes(search.toLowerCase())), [catalog, search]);
  const versions = vehicles.flatMap(([key, vehicle]) => vehicle.versions.map((version) => ({ key, vehicle, version })));

  return <div className="space-y-6 p-6 lg:p-9">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Danh mục xe</h1><p className="mt-2 text-sm text-slate-500">Dữ liệu phiên bản, màu sắc và giá đang được configurator sử dụng.</p></div><label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm dòng xe…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-700" /></label></header>
    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><Info size={17} className="mt-0.5 shrink-0" /><p>Đây là dữ liệu giá hiện hành từ hệ thống. Giao diện hiện hỗ trợ xem; chỉnh sửa và lên lịch hiệu lực giá cần được bổ sung ở bước tiếp theo để bảo toàn lịch sử báo giá.</p></div>
    {query.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{query.error.message}</p>}
    {query.isPending ? <div className="rounded-2xl border bg-white p-12 text-center text-sm text-slate-500">Đang tải danh mục xe…</div> : <>
      <section className="grid gap-4 sm:grid-cols-3"><Stat icon={CarFront} label="Dòng xe" value={String(vehicles.length)} /><Stat icon={PackageCheck} label="Phiên bản" value={String(versions.length)} /><Stat icon={BatteryCharging} label="Phụ kiện" value={String(catalog?.accessories.length ?? 0)} /></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Giá xe đang áp dụng</h2><p className="mt-1 text-xs text-slate-500">Giá hiển thị theo phiên bản; chọn xe để xem pin và màu hiện có.</p></div>{versions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Dòng xe</th><th className="px-4 py-3">Phiên bản</th><th className="px-4 py-3">Giá từ</th><th className="px-4 py-3">Màu</th><th className="px-4 py-3">Pin mua / thuê</th></tr></thead><tbody className="divide-y divide-slate-100">{versions.map(({ key, vehicle, version }) => <tr key={`${key}-${version.id}`} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-800">VinFast {vehicle.label}<span className="ml-2 text-xs font-normal text-slate-400">{key}</span></td><td className="px-4 py-4 text-slate-600">{version.label}</td><td className="px-4 py-4 font-semibold text-slate-800">{money(version.price)}</td><td className="px-4 py-4"><div className="flex items-center gap-1.5">{vehicle.colors.slice(0, 7).map((color) => <span key={color.id} title={color.label} className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: color.hex }} />)}<span className="ml-1 text-xs text-slate-500">{vehicle.colors.length}</span></div></td><td className="px-4 py-4 text-xs leading-5 text-slate-600">{money(vehicle.battery.buy)}<br />{money(vehicle.battery.rent)}/tháng</td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-sm text-slate-500">Không tìm thấy dòng xe phù hợp.</p>}</section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Phụ kiện</h2><p className="mt-1 text-xs text-slate-500">Giá và các dòng xe tương thích</p></div><div className="grid gap-3 p-5 md:grid-cols-2">{(catalog?.accessories ?? []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.label}</p><p className="mt-1 text-xs text-slate-500">{item.compatibleModels.length ? item.compatibleModels.join(", ") : "Tất cả dòng xe"}</p></div><span className="shrink-0 text-sm font-semibold text-slate-700">{money(item.price)}</span></div>)}</div></section>
    </>}
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string }) { return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={19} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div></div>; }
