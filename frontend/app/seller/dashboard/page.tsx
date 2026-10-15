"use client";

import type { LeadResponse, QuoteResponse } from "@/lib/api-types";

import { useQuery } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { readApiError } from "@/lib/catalog-api";
import { useAuthStore } from '@/lib/auth-store';
import { formatVND } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users, TrendingUp,
  Clock, CheckCircle,
  FilePlus, RefreshCw
} from "lucide-react";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dashboard = useQuery({
    queryKey: ['seller-dashboard', user?.id], enabled: !!user,
    queryFn: async ({ signal }) => {
      const [leadsRes, quotesRes] = await Promise.all([
        fetch('/api/leads', { signal, cache: 'no-store' }),
        fetch('/api/quotes', { signal, cache: 'no-store' }),
      ]);
      if (!leadsRes.ok) throw new Error(await readApiError(leadsRes, 'Không tải được leads.'));
      if (!quotesRes.ok) throw new Error(await readApiError(quotesRes, 'Không tải được báo giá.'));
      return { leads: (await leadsRes.json()).leads as LeadResponse[],
        quotes: (await quotesRes.json()).quotes as QuoteResponse[] };
    }, refetchInterval: 10000, refetchIntervalInBackground: false, retry: false,
  }, getQueryClient());
  const loading = dashboard.isFetching;
  const leads = dashboard.data?.leads ?? [];
  const quotes = dashboard.data?.quotes ?? [];
  const approved = quotes.filter((q) => q.status === 'approved');
  const stats = {
    totalLeads: leads.length, pendingQuotes: quotes.filter((q) => q.status === 'pending').length,
    approvedQuotes: approved.length, conversionRate: quotes.length ? Math.round(approved.length / quotes.length * 100) : 0,
    totalRevenue: approved.reduce((sum, q) => sum + Number(q.final_price), 0),
  };
  const counts: Record<string, number> = {};
  quotes.forEach((q) => { counts[q.model] = (counts[q.model] ?? 0) + 1; });
  const modelCounts = Object.entries(counts).map(([model, count]) => ({ model, count, color: '#3B82F6' })).sort((a, b) => b.count - a.count);
  const recentQuotes = quotes.slice(0, 5);
  // Group actual created_at timestamps into the current week in Vietnam.
  const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const today = new Date();
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' }).format(today);
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekdayName];
  const weeklyData = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, index) => {
    const date = new Date(today.getTime() + (index + 1 - weekday) * 86400000);
    const key = dayKey(date);
    const recordDay = (value: string) => dayKey(new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z'));
    return { day, leads: leads.filter((l) => recordDay(l.created_at) === key).length,
      quotes: quotes.filter((q) => recordDay(q.created_at) === key).length };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan (Dashboard)</h1>
          <p className="text-slate-500 text-sm mt-1">Số liệu từ leads và báo giá đã lưu</p>
        </div>
        <button
          onClick={() => dashboard.refetch()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {dashboard.isError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{dashboard.error.message} {dashboard.data ? 'Đang hiển thị lần tải thành công trước đó.' : 'Chưa có dữ liệu để thống kê.'}</p>}
      {dashboard.isPending && <p role="status">Đang tải thống kê…</p>}
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} className="text-blue-600" />}
          bg="bg-blue-50"
          label="Tổng leads"
          value={stats.totalLeads}
          sub="Khách hàng trong DB"
          subColor="text-blue-600"
        />
        <StatCard
          icon={<Clock size={20} className="text-yellow-600" />}
          bg="bg-yellow-50"
          label="Báo giá chờ duyệt"
          value={stats.pendingQuotes}
          sub="Cần tư vấn xử lý"
          subColor="text-yellow-600"
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-green-600" />}
          bg="bg-green-50"
          label="Tỷ lệ duyệt"
          value={`${stats.conversionRate}%`}
          sub={`${stats.approvedQuotes} báo giá đã duyệt`}
          subColor="text-green-600"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-purple-600" />}
          bg="bg-purple-50"
          label="Giá trị báo giá đã duyệt"
          value={formatVND(stats.totalRevenue)}
          sub="Chưa phải doanh thu bán xe"
          subColor="text-slate-500"
          small
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leads theo tuần */}
        <div className="lg:col-span-2 bg-white rounded-3xl border p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Biểu đồ Leads & Báo giá tuần này</h2>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={weeklyData} barGap={4}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
              />
              <Bar dataKey="leads" name="Leads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="quotes" name="Báo giá" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Xe được quan tâm */}
        <div className="bg-white rounded-3xl border p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Dòng xe được yêu cầu báo giá</h2>
          <div className="space-y-3.5">
            {modelCounts.map((item) => {
              const max = Math.max(...modelCounts.map((x) => x.count), 1);
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.model}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">VinFast {item.model}</span>
                    <span className="text-slate-500 font-semibold">{item.count} đơn</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-3xl border p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Báo giá gần đây nhất</h2>
        <div className="space-y-3">
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">Chưa có hoạt động báo giá nào</p>
          ) : (
            recentQuotes.map((q: QuoteResponse) => (
              <div key={q.id} className="flex items-center justify-between py-2.5 border-b last:border-0 gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-blue-600">
                    <FilePlus size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {q.buyer_name || "Khách hàng"} yêu cầu báo giá {q.model} {q.version}
                    </p>
                    <p className="text-xs text-slate-400">
                      {q.color} · {q.province} · {formatVND(q.final_price)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    q.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : q.status === "rejected"
                      ? "bg-red-100 text-red-600"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {q.status === "approved" ? "Đã duyệt" : q.status === "rejected" ? "Từ chối" : "Chờ duyệt"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, bg, label, value, sub, subColor, small,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string | number;
  sub: string;
  subColor: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border p-5 shadow-sm">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-bold text-slate-900 ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
    </div>
  );
}
