"use client";

import {
  DASHBOARD_STATS, WEEKLY_LEADS, MODEL_INTEREST,
} from "@/lib/seller-mock-data";
import { formatVND } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users, TrendingUp,
  Clock, CheckCircle,
  FilePlus, CheckCircle2, MessageSquare, ClipboardList, XCircle
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="text-slate-500 text-sm mt-1">Tháng 10/2026 · Đại lý ABC Hà Nội</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} className="text-blue-600" />}
          bg="bg-blue-50"
          label="Tổng leads"
          value={DASHBOARD_STATS.totalLeads}
          sub={`+${DASHBOARD_STATS.leadsThisWeek} tuần này`}
          subColor="text-green-600"
        />
        <StatCard
          icon={<Clock size={20} className="text-yellow-600" />}
          bg="bg-yellow-50"
          label="Báo giá chờ duyệt"
          value={DASHBOARD_STATS.pendingQuotes}
          sub="Cần xử lý"
          subColor="text-yellow-600"
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-green-600" />}
          bg="bg-green-50"
          label="Đã chốt"
          value={`${DASHBOARD_STATS.conversionRate}%`}
          sub={`${DASHBOARD_STATS.approvedQuotes} đơn`}
          subColor="text-green-600"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-purple-600" />}
          bg="bg-purple-50"
          label="Doanh thu tháng"
          value={formatVND(DASHBOARD_STATS.revenueThisMonth)}
          sub={formatVND(DASHBOARD_STATS.totalRevenue) + " tổng"}
          subColor="text-slate-500"
          small
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leads theo tuần */}
        <div className="lg:col-span-2 bg-white rounded-3xl border p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Leads & Báo giá trong tuần</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY_LEADS} barGap={4}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
              />
              <Bar dataKey="leads"  name="Leads"   fill="#3B82F6" radius={[4,4,0,0]} />
              <Bar dataKey="quotes" name="Báo giá" fill="#10B981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Xe được quan tâm */}
        <div className="bg-white rounded-3xl border p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Xe được quan tâm</h2>
          <div className="space-y-3">
            {MODEL_INTEREST.map((item) => {
              const max = MODEL_INTEREST[0].count;
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.model}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{item.model}</span>
                    <span className="text-slate-500">{item.count} lượt</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
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
        <h2 className="font-semibold text-slate-900 mb-4">Hoạt động gần đây</h2>
        <div className="space-y-3">
          {[
            { icon: <FilePlus size={16} className="text-blue-600" />, text:"Nguyễn Văn An yêu cầu báo giá VF6 Plus",        time:"9 phút trước",  color:"text-blue-600" },
            { icon: <CheckCircle2 size={16} className="text-green-600" />, text:"Phạm Thị Dung đã đặt cọc - VF6 Plus Xanh",       time:"2 giờ trước",   color:"text-green-600" },
            { icon: <MessageSquare size={16} className="text-slate-600" />, text:"Vũ Thị Hoa hỏi về màu xanh VF7",                  time:"3 giờ trước",   color:"text-slate-600" },
            { icon: <ClipboardList size={16} className="text-blue-600" />, text:"Đặng Văn Hùng yêu cầu báo giá VF6 Tiêu chuẩn",  time:"Hôm qua 14:00", color:"text-blue-600" },
            { icon: <XCircle size={16} className="text-red-500" />, text:"Hoàng Minh Đức từ chối báo giá VF8",             time:"Hôm qua 16:00", color:"text-red-500"  },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50">{item.icon}</span>
              <span className={`flex-1 text-sm ${item.color}`}>{item.text}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{item.time}</span>
            </div>
          ))}
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
