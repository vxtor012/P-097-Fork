"use client";

import { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageCircle, X, ChevronLeft } from "lucide-react";
import { SiteNav } from "@/components/shared/site-nav";
import { CarImage } from "@/components/shared/car-image";
import { Stepper } from "@/components/configurator/stepper";
import { ChatPanel } from "@/components/configurator/chat-panel";
import { useConfigurator } from "@/hooks/use-configurator";
import { useChat } from "@/hooks/use-chat";
import { fromQuery, toQuery } from "@/lib/config-url";
import { VEHICLES, PROVINCES, ACCESSORIES } from "@/lib/vehicle-data";
import { formatNumber } from "@/lib/format";

// Dynamic import CarViewer3D không chạy SSR để tránh lỗi Hydration Mismatch
const CarViewer3D = dynamic(
  () => import("@/components/configurator/car-viewer-3d").then((m) => m.CarViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[380px] w-full items-center justify-center sm:h-[440px] md:h-[500px]">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
      </div>
    ),
  }
);

function Customize() {
  const searchParams = useSearchParams();
  const configurator = useConfigurator(fromQuery(searchParams));
  const chat = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { config, setField, toggleAccessory, pricing, vehicle } = configurator;
  const v = vehicle || VEHICLES[config.model];
  const query = toQuery(config);
  const opt = (on: boolean) =>
    `rounded-2xl border px-4 py-3 text-left text-sm transition ${
      on ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"
    }`;

  // Trong lúc chờ mount trên client, render khung giao diện nhất quán
  if (!mounted) {
    return (
      <div className="flex h-[100dvh] flex-col bg-white">
        <SiteNav />
        <Stepper current={1} query="" />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <SiteNav />
      <Stepper current={1} query={query} />
      <main className="min-h-0 flex-1 overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_380px_380px] xl:grid-rows-1 xl:overflow-hidden">
        {/* CỘT 1: HIỂN THỊ XE 3D - TRÊN MOBILE GHIM 1/3 MÀN HÌNH (STICKY), TRÊN DESKTOP GIỮ NGUYÊN TOÀN BỘ KHÔNG GIAN */}
        <section className="sticky top-0 z-30 flex h-[34dvh] w-full shrink-0 flex-col overflow-hidden border-b border-slate-100 bg-white p-0 shadow-sm xl:relative xl:top-auto xl:z-auto xl:h-full xl:flex-1 xl:border-b-0 xl:shadow-none">
          {/* Thông tin dòng xe thanh lịch ở góc trên */}
          <div className="pointer-events-auto absolute left-4 top-3 right-4 z-20 flex items-start justify-between xl:left-8 xl:top-7 xl:right-8">
            <div>
              <Link
                href="/configurator"
                className="group mb-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 xl:mb-1.5 xl:text-xs"
              >
                <ChevronLeft size={13} className="transition group-hover:-translate-x-0.5" />
                <span>Đổi dòng xe khác</span>
              </Link>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl md:text-2xl xl:text-3xl">
                VinFast {v.label}
              </h1>
            </div>
            <span className="rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 backdrop-blur-sm shadow-sm xl:px-3 xl:py-1 xl:text-xs">
              {pricing.version.label}
            </span>
          </div>

          {/* Chữ chìm nghệ thuật phía sau */}
          <span className="pointer-events-none absolute left-8 top-14 select-none text-[80px] font-black leading-none text-slate-100/50 hidden sm:block md:text-[140px] xl:block xl:text-[200px]">
            {v.label.replace(" ", "")}
          </span>

          {/* Xe 3D Three.js chiếm toàn bộ không gian của Cột 1 */}
          <div className="relative z-10 h-full w-full flex-1">
            <CarViewer3D
              modelUrl={v.model3d}
              modelName={v.label}
              colorHex={pricing.color.hex}
              roofHex={(pricing.color as any)?.roofHex || (pricing.color as any)?.roof_hex || pricing.color.hex}
              className="h-full w-full"
              fallback2D={
                <CarImage
                  model={config.model}
                  colorId={config.colorId}
                  alt={`VinFast ${v.label}`}
                  maxWidth={720}
                  className="mx-auto"
                />
              }
            />
          </div>
        </section>

        {/* CỘT 2: BẢNG TUỲ CHỈNH ĐỒNG BỘ BÊN PHẢI (GỒM PHIÊN BẢN, MÀU NGOẠI THẤT, PIN...) */}
        <section className="min-h-0 space-y-7 px-6 py-6 xl:overflow-y-auto xl:border-l xl:border-slate-200">
          {/* 1. Phiên bản */}
          <Group title="Phiên bản">
            {v.versions.map((x) => (
              <button
                key={x.id}
                onClick={() => setField("versionId", x.id)}
                className={`${opt(x.id === config.versionId)} flex w-full justify-between`}
              >
                <span className="font-semibold">{x.label}</span>
                <span>{formatNumber(x.price)}đ</span>
              </button>
            ))}
          </Group>

          {/* 2. Màu ngoại thất (Đã chuyển sang đây cho đồng bộ) */}
          <Group title="Màu ngoại thất">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">{pricing.color.label}</span>
              <span className="text-xs text-slate-400">Đã bao gồm trong giá</span>
            </div>
            <div className="flex flex-wrap gap-3 py-1">
              {v.colors.map((c: any) => {
                const roof = c.roofHex || c.roof_hex;
                const isTwoTone = Boolean(roof && roof.toLowerCase() !== c.hex.toLowerCase());
                const swatchBackground = isTwoTone
                  ? `linear-gradient(135deg, ${c.hex} 50%, ${roof} 50%)`
                  : c.hex;

                return (
                  <button
                    key={c.id}
                    onClick={() => setField("colorId", c.id)}
                    aria-label={c.label}
                    title={c.label}
                    className={`h-10 w-10 rounded-full border border-slate-300 transition-all ${
                      c.id === config.colorId
                        ? "scale-110 shadow-md ring-2 ring-blue-600 ring-offset-2"
                        : "hover:scale-105 hover:border-slate-400"
                    }`}
                    style={{ background: swatchBackground }}
                  />
                );
              })}
            </div>
          </Group>

          {/* 3. Gói Pin */}
          <Group title="Pin">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setField("battery", "rent")}
                className={opt(config.battery === "rent")}
              >
                <b>Thuê pin</b>
                <br />
                {formatNumber(v.battery.rent)}đ/tháng
              </button>
              <button
                onClick={() => setField("battery", "buy")}
                className={opt(config.battery === "buy")}
              >
                <b>Mua pin</b>
                <br />
                +{formatNumber(v.battery.buy)}đ
              </button>
            </div>
          </Group>

          {/* 4. Nơi đăng ký xe */}
          <Group title="Nơi đăng ký xe">
            <select
              value={config.provinceId}
              onChange={(e) => setField("provinceId", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              {Object.entries(PROVINCES).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Group>

          {/* 5. Phụ kiện */}
          <Group title="Phụ kiện">
            <div className="grid grid-cols-1 gap-2">
              {ACCESSORIES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAccessory(a.id)}
                  className={opt(config.accessories.includes(a.id))}
                >
                  <span className="block font-medium">{a.label}</span>
                  <span className="text-slate-500">{formatNumber(a.price)}đ</span>
                </button>
              ))}
            </div>
          </Group>
        </section>

        {/* CỘT 3: CHAT VỚI TRỢ LÝ (MÀN NHỎ: MỞ MODAL/DRAWER) */}
        <aside
          className={`${
            chatOpen ? "fixed inset-0 z-50 flex" : "hidden"
          } min-h-0 flex-col bg-white xl:static xl:z-auto xl:flex xl:border-l xl:border-slate-200`}
        >
          <button
            onClick={() => setChatOpen(false)}
            className="flex items-center justify-end gap-1 border-b px-4 py-3 text-sm text-slate-500 xl:hidden"
          >
            <X size={16} />
            Đóng
          </button>
          <div className="min-h-0 flex-1">
            <ChatPanel chat={chat} configurator={configurator} />
          </div>
        </aside>
      </main>

      {/* THANH TỔNG TIỀN DƯỚI ĐÁY - GIÃN SÁT 2 VIỀN, CẢ GIÁ VÀ NÚT CÙNG Ở BÊN PHẢI TRÊN DESKTOP */}
      <div className="flex-none border-t border-slate-200 bg-white px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-3 xl:px-10">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4">
          {/* Phía bên trái desktop: tóm tắt thông tin */}
          <div className="hidden xl:flex items-center gap-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">VinFast {v.label} {pricing.version.label}</span>
            <span>·</span>
            <span>{pricing.color.label}</span>
            <span>·</span>
            <span className="font-medium text-emerald-600">Bảo hành 10 năm</span>
          </div>

          {/* Phía bên phải: Cả cụm Giá bán + Nút xem báo giá cùng dồn sát ra phía bên phải */}
          <div className="flex w-full items-center justify-between gap-2 sm:gap-4 xl:w-auto xl:justify-end xl:gap-6">
            <div className="min-w-0 text-left xl:text-right">
              <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs">
                <span className="sm:hidden">Dự tính lăn bánh</span>
                <span className="hidden sm:inline">Giá lăn bánh dự tính, đã trừ ưu đãi</span>
              </p>
              <p className="mt-0.5 text-lg font-bold leading-tight text-slate-900 sm:text-2xl xl:text-2xl">
                {formatNumber(pricing.finalPrice)}đ
              </p>
            </div>
            <Link
              href={`/configurator/quote?${query}`}
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 sm:px-6 sm:py-3 sm:text-sm xl:px-8 xl:py-3.5 xl:text-base whitespace-nowrap shadow-sm"
            >
              <span className="sm:hidden">Xem báo giá</span>
              <span className="hidden sm:inline">Xem báo giá chi tiết</span>
            </Link>
          </div>
        </div>
      </div>

      {/* NÚT HỎI TRỢ LÝ TRÊN MÀN HÌNH NHỎ */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 rounded-full bg-slate-900/95 backdrop-blur-sm px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-slate-800 sm:bottom-24 sm:right-5 sm:px-5 sm:py-3 sm:text-sm xl:hidden"
      >
        <MessageCircle size={16} />
        Hỏi trợ lý
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600" />
        </div>
      }
    >
      <Customize />
    </Suspense>
  );
}
