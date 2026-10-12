"use client";

import { useState, useEffect } from "react";
import { formatVND } from "@/lib/format";
import { MessageCircle, Phone, Search, MapPin, Car, DollarSign, Clock, RefreshCw } from "lucide-react";

export interface LeadItem {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  province: string;
  interestedIn: string;
  budget: number;
  status: "new" | "contacted" | "quoted" | "closed_won" | "closed_lost";
  createdAt: string;
  lastMessage?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  new:         { label: "Mới",         color: "bg-blue-100 text-blue-700"   },
  contacted:   { label: "Đã liên hệ",  color: "bg-yellow-100 text-yellow-700"},
  quoted:      { label: "Đã báo giá",  color: "bg-purple-100 text-purple-700"},
  closed_won:  { label: "Đã chốt",     color: "bg-green-100 text-green-700"  },
  closed_lost: { label: "Không chốt",  color: "bg-red-100 text-red-600"     },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState("all");
  const [selected, setSelected] = useState<LeadItem | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        const mapped: LeadItem[] = (data.leads || []).map((l: any) => ({
          id: l.id,
          sessionId: l.session_id,
          name: l.name || "Khách ẩn danh",
          phone: l.phone || "Chưa có SĐT",
          province: l.province || "Chưa xác định",
          interestedIn: l.interested_in || "Chưa chọn xe",
          budget: Number(l.budget) || 0,
          status: (l.status in STATUS_CONFIG ? l.status : "new") as LeadItem["status"],
          createdAt: l.created_at ? new Date(l.created_at).toLocaleDateString("vi-VN") : "Hôm nay",
          lastMessage: l.note || "Tư vấn cấu hình xe",
        }));
        setLeads(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: newStatus as any } : l))
        );
        if (selected?.id === leadId) {
          setSelected((prev) => (prev ? { ...prev, status: newStatus as any } : null));
        }
      }
    } catch (err) {
      console.error("Failed to update lead status:", err);
    }
  };

  const filtered = leads.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.interestedIn.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex h-full">
      {/* ── LEFT: List ── */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Khách hàng (Leads)</h1>
            <p className="text-slate-500 text-sm mt-1">
              {leads.length} khách hàng được ghi nhận từ hệ thống
            </p>
          </div>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, SĐT, xe quan tâm..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {["all", ...Object.keys(STATUS_CONFIG)].map((s) => {
            const count = s === "all" ? leads.length : leads.filter((l) => l.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border text-slate-600 hover:border-blue-300"
                }`}
              >
                {s === "all" ? "Tất cả" : STATUS_CONFIG[s].label} ({count})
              </button>
            );
          })}
        </div>

        {/* Lead cards */}
        {loading && leads.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang tải dữ liệu từ database...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Không tìm thấy khách hàng phù hợp</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setSelected(lead)}
                className={`w-full text-left bg-white rounded-2xl border p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all ${
                  selected?.id === lead.id ? "border-blue-500 ring-1 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{lead.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[lead.status]?.color}`}>
                        {STATUS_CONFIG[lead.status]?.label ?? lead.status}
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 font-medium">{lead.interestedIn}</p>
                    {lead.lastMessage && (
                      <p className="text-xs text-slate-400 mt-1 truncate flex items-center gap-1">
                        <MessageCircle size={12} className="shrink-0" />
                        <span>&quot;{lead.lastMessage}&quot;</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-slate-700">{formatVND(lead.budget)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{lead.province}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">{lead.createdAt}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Detail ── */}
      {selected ? (
        <div className="w-80 border-l bg-white flex-shrink-0 overflow-y-auto">
          <div className="px-5 py-5 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900">{selected.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[selected.status]?.color}`}>
                {STATUS_CONFIG[selected.status]?.label ?? selected.status}
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400" /> {selected.phone}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-slate-400" /> {selected.province}
              </p>
              <p className="flex items-center gap-2">
                <Car size={14} className="text-slate-400" /> Quan tâm: <strong>{selected.interestedIn}</strong>
              </p>
              <p className="flex items-center gap-2">
                <DollarSign size={14} className="text-slate-400" /> Ngân sách:{" "}
                <strong className="text-blue-600">{formatVND(selected.budget)}</strong>
              </p>
              <p className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> Ngày tạo: {selected.createdAt}
              </p>
            </div>
          </div>

          {selected.lastMessage && (
            <div className="px-5 py-4 border-b">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ghi chú / Yêu cầu</p>
              <p className="text-sm text-slate-700 italic">&quot;{selected.lastMessage}&quot;</p>
            </div>
          )}

          <div className="px-5 py-4 border-b">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cập nhật trạng thái</p>
            <select
              value={selected.status}
              onChange={(e) => handleStatusChange(selected.id, e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="px-5 py-4 space-y-2">
            <a
              href={`tel:${selected.phone}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Phone size={15} /> Gọi điện
            </a>
            <a
              href={`https://zalo.me/${selected.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium transition-colors"
            >
              <MessageCircle size={15} /> Nhắn Zalo
            </a>
          </div>
        </div>
      ) : (
        <div className="w-80 border-l bg-slate-50 flex-shrink-0 flex items-center justify-center text-slate-400 text-sm">
          Chọn khách hàng để xem chi tiết
        </div>
      )}
    </div>
  );
}
