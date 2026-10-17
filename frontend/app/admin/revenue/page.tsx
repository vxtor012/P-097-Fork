"use client";

import { CircleDollarSign, RefreshCw, TrendingUp, Users } from "lucide-react";
import { useStaffData } from "@/hooks/use-staff-data";

type Revenue = {
  summary: { closed_leads: number; estimated_value: number; average_value: number };
  monthly: { month: string; closed_leads: number; estimated_value: number }[];
  dealers: { dealer_id: string; dealer: string; closed_leads: number; estimated_value: number }[];
  basis: string;
};

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + " ₫";
const monthName = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 1).toLocaleDateString("vi-VN", { month: "short", year: "2-digit" });
};

export default function AdminRevenuePage() {
  const query = useStaffData<Revenue>("admin-revenue", "/api/admin/revenue");
  const data = query.data;
  const monthly = data?.monthly ?? [];
  const maxMonth = Math.max(...monthly.map((row) => Number(row.estimated_value)), 1);

  return <div className="space-y-6 p-6 lg:p-9">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Doanh thu ước tính</h1><p className="mt-2 text-sm text-slate-500">Tổng hợp giá trị báo giá gắn với khách hàng đã chốt trên toàn hệ thống.</p></div><button onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />Làm mới</button></header>

    <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><CircleDollarSign size={18} className="mt-0.5 shrink-0" /><p>{data?.basis ?? "Chỉ số đang được tính từ báo giá đã duyệt và trạng thái khách hàng. Đây là giá trị ước tính, không phải sổ ghi nhận thanh toán thực tế."}</p></div>
    {query.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{query.error.message}</p>}
    {query.isPending && !data ? <div className="rounded-2xl border bg-white p-12 text-center text-sm text-slate-500">Đang tải số liệu…</div> : <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CircleDollarSign} label="Giá trị chốt ước tính" value={money(data?.summary.estimated_value ?? 0)} />
        <Stat icon={Users} label="Khách đã chốt" value={new Intl.NumberFormat("vi-VN").format(data?.summary.closed_leads ?? 0)} />
        <Stat icon={TrendingUp} label="Giá trị trung bình / khách" value={money(data?.summary.average_value ?? 0)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5"><h2 className="font-semibold text-slate-900">Giá trị theo tháng</h2><p className="mt-1 text-xs text-slate-500">12 tháng gần nhất, tính theo ngày duyệt báo giá.</p></div>
        {monthly.length ? <div className="space-y-4">{monthly.map((row) => <div key={row.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm"><span className="text-slate-500">{monthName(row.month)}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(2, Number(row.estimated_value) / maxMonth * 100)}%` }} /></div><span className="min-w-32 text-right font-medium text-slate-800">{money(row.estimated_value)}</span></div>)}</div> : <p className="py-10 text-center text-sm text-slate-500">Chưa có khách đã chốt kèm báo giá được duyệt.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Theo đại lý</h2><p className="mt-1 text-xs text-slate-500">Xếp theo giá trị chốt ước tính.</p></div>{data?.dealers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Đại lý</th><th className="px-4 py-3 text-right">Khách đã chốt</th><th className="px-5 py-3 text-right">Giá trị ước tính</th></tr></thead><tbody className="divide-y divide-slate-100">{data.dealers.map((row) => <tr key={row.dealer_id}><td className="px-5 py-4 font-medium text-slate-800">{row.dealer}</td><td className="px-4 py-4 text-right text-slate-600">{new Intl.NumberFormat("vi-VN").format(row.closed_leads)}</td><td className="px-5 py-4 text-right font-semibold text-slate-800">{money(row.estimated_value)}</td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-sm text-slate-500">Chưa có số liệu theo đại lý.</p>}</section>
    </>}
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={19} /></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-bold text-slate-900 sm:text-2xl">{value}</p></div></div>;
}
