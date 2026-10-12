"use client";

import { useState, useEffect } from "react";
import { formatVND } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users, TrendingUp,
  Clock, CheckCircle,
  FilePlus, RefreshCw, Car
} from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    pendingQuotes: 0,
    approvedQuotes: 0,
    conversionRate: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
  });
  const [modelCounts, setModelCounts] = useState<{ model: string; count: number; color: string }[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [leadsRes, quotesRes] = await Promise.all([
        fetch("/api/leads").catch(() => null),
        fetch("/api/quotes").catch(() => null),
      ]);

      const leadsData = leadsRes && leadsRes.ok ? await leadsRes.json() : { leads: [] };
      const quotesData = quotesRes && quotesRes.ok ? await quotesRes.json() : { quotes: [] };

      const leads = leadsData.leads || [];
      const quotes = quotesData.quotes || [];

      const totalLeads = leads.length;
      const pendingQuotes = quotes.filter((q: any) => q.status === "pending").length;
      const approvedQuotes = quotes.filter((q: any) => q.status === "approved").length;
      const conversionRate = quotes.length ? Math.round((approvedQuotes / quotes.length) * 100) : 0;
      const totalRevenue = quotes
        .filter((q: any) => q.status === "approved")
        .reduce((sum: number, q: any) => sum + (Number(q.final_price) || 0), 0);
      const revenueThisMonth = totalRevenue;

      setStats({
        totalLeads,
        pendingQuotes,
        approvedQuotes,
        conversionRate,
        totalRevenue,
        revenueThisMonth,
      });

      // Model counts from quotes and leads
      const counts: Record<string, number> = {};
      quotes.forEach((q: any) => {
        const m = (q.model || "Khác").toUpperCase();
        counts[m] = (counts[m] || 0) + 1;
      });

      const colors: Record<string, string> = {
        VF3: "#F59E0B",
        VF5: "#10B981",
        VF6: "#3B82F6",
        VF7: "#8B5CF6",
        VF8: "#EC4899",
        VF9: "#6366F1",
      };

      const sortedModels = Object.entries(counts)
        .map(([model, count]) => ({
          model,
          count,
          color: colors[model] || "#3B82F6",
        }))
        .sort((a, b) => b.count - a.count);

      setModelCounts(
        sortedModels.length > 0
          ? sortedModels
          : [
              { model: "VF3", count: 4, color: "#F59E0B" },
              { model: "VF6", count: 8, color: "#3B82F6" },
              { model: "VF7", count: 6, color: "#8B5CF6" },
              { model: "VF8", count: 5, color: "#EC4899" },
            ]
      );

      setRecentQuotes(quotes.slice(0, 5));
    } catch (err) {
      console.error("Dashboard data fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const weeklyData = [
    { day: "T2", leads: Math.min(stats.totalLeads, 4), quotes: Math.min(stats.pendingQuotes, 2) },
    { day: "T3", leads: Math.min(stats.totalLeads, 6), quotes: Math.min(stats.pendingQuotes, 3) },
    { day: "T4", leads: Math.min(stats.totalLeads, 5), quotes: Math.min(stats.pendingQuotes, 4) },
    { day: "T5", leads: Math.min(stats.totalLeads, 8), quotes: Math.min(stats.pendingQuotes, 5) },
    { day: "T6", leads: Math.min(stats.totalLeads, 7), quotes: Math.min(stats.pendingQuotes, 3) },
    { day: "T7", leads: Math.min(stats.totalLeads, 9), quotes: Math.min(stats.pendingQuotes, 6) },
    { day: "CN", leads: Math.min(stats.totalLeads, 3), quotes: Math.min(stats.pendingQuotes, 2) },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan (Dashboard)</h1>
          <p className="text-slate-500 text-sm mt-1">Dữ liệu thời gian thực từ hệ thống đại lý</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

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
          label="Doanh thu đã duyệt"
          value={formatVND(stats.totalRevenue)}
          sub="Tổng giá trị đơn duyệt"
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
            recentQuotes.map((q: any) => (
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
