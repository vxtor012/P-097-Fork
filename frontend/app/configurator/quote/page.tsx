"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/shared/site-nav";
import { CarImage } from "@/components/shared/car-image";
import { Stepper } from "@/components/configurator/stepper";
import { BuyerIdentityModal } from "@/components/shared/buyer-identity-modal";
import { useConfigurator } from "@/hooks/use-configurator";
import { fromQuery, toQuery } from "@/lib/config-url";
import { VEHICLES } from "@/lib/vehicle-data";
import { formatVND } from "@/lib/format";

function Quote() {
  const { config, pricing, vehicle } = useConfigurator(fromQuery(useSearchParams()));
  const [open, setOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPreviewPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch("/api/quote/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          version: pricing.version.label,
          color: pricing.color.label,
          battery: config.battery,
          province: pricing.province.label,
          final_price: pricing.finalPrice,
          price_version: "2025-Q4-v1",
          price_snapshot: {
            base_price: pricing.basePrice,
            battery_cost: pricing.batteryPrice,
            accessories: pricing.accList.map((a) => ({ name: a.label, price: a.price })),
            rolling_costs: {
              registration_fee: pricing.registrationFee,
              plate_fee: pricing.plateFee,
              road_fee: pricing.roadFee,
              inspection_fee: pricing.inspectionFee,
              insurance: pricing.insuranceFee,
            },
            promotions: pricing.promos,
            final_price: pricing.finalPrice,
          },
        }),
      });

      if (!res.ok) throw new Error("Không thể tạo PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VinFast_BaoGia_${config.model}_${pricing.version.label}.pdf`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Lỗi khi tải PDF báo giá.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const v = vehicle || VEHICLES[config.model];
  const text = `${v.label} ${pricing.version.label} · ${pricing.color.label} · ${pricing.province.label}`;
  const rows: [string, number][] = [
    [`Giá xe ${v.label} ${pricing.version.label}`, pricing.basePrice],
    ...(config.battery === "buy" ? [["Mua pin", pricing.batteryPrice] as [string, number]] : []),
    ...pricing.accList.map((a) => [a.label, a.price] as [string, number]),
    ["Lệ phí trước bạ", pricing.registrationFee],
    ["Phí sử dụng đường bộ", pricing.roadFee],
    ["Đăng kiểm", pricing.inspectionFee],
    ["Bảo hiểm", pricing.insuranceFee],
    ["Biển số", pricing.plateFee],
  ];

  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <Stepper current={2} query={toQuery(config)} />
      <main className="mx-auto grid max-w-6xl gap-8 px-5 pb-16 pt-4 lg:grid-cols-[1fr_460px]">
        <section className="rounded-3xl bg-slate-50 p-6">
          <CarImage
            model={config.model}
            colorId={config.colorId}
            imageUrl={(pricing.color as any)?.imageUrl || (pricing.color as any)?.image_url}
            alt={v.label}
            maxWidth={560}
            className="mx-auto"
          />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">VinFast {v.label} {pricing.version.label}</h1>

          <p className="mt-1 text-slate-500">{pricing.color.label} · Pin {config.battery === "rent" ? `thuê (${formatVND(pricing.batteryRent)}/tháng)` : "mua"} · {pricing.province.label}</p>
          <Link href={`/configurator/customize?${toQuery(config)}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><ArrowLeft size={16} />Sửa cấu hình</Link>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">Chi phí lăn bánh</h2>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {rows.map(([k, n]) => (
              <div key={k} className="flex justify-between py-3"><dt className="text-slate-600">{k}</dt><dd className="font-medium text-slate-900">{formatVND(n)}</dd></div>
            ))}
            {pricing.promos.map((p) => (
              <div key={p.name} className="flex justify-between py-3 text-green-700"><dt>{p.name} <span className="text-slate-400">({p.source})</span></dt><dd className="font-medium">-{formatVND(p.value)}</dd></div>
            ))}
          </dl>
          <div className="mt-2 flex items-end justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-sm text-white/70">Tổng dự tính</span><span className="text-2xl font-bold">{formatVND(pricing.finalPrice)}</span>
          </div>
          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-full bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              Yêu cầu báo giá chính thức
            </button>
            <button
              onClick={downloadPreviewPdf}
              disabled={downloadingPdf}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-blue-600 py-3 font-semibold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              <span>{downloadingPdf ? "Đang tạo PDF..." : "Tải Báo Giá PDF Ngay"}</span>
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Giá chỉ mang tính tham khảo. Báo giá chính thức do tư vấn viên của đại lý xác nhận.</p>
        </section>

      </main>
      <BuyerIdentityModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={async (info) => {
          const sessionId =
            typeof window !== "undefined"
              ? sessionStorage.getItem("vf_session") || "web-" + Math.random().toString(36).slice(2, 9)
              : "web-session";

          // 1. Lưu Lead khách hàng tiềm năng
          await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              name: info.name,
              phone: info.phone,
              province: info.province || pricing.province.label,
              interested_in: `${v.label} ${pricing.version.label}`,
              budget: pricing.finalPrice,
              note: info.note || `Cấu hình ${pricing.color.label}, Pin ${config.battery === "buy" ? "Mua pin" : "Thuê pin"}`,
            }),
          });

          // 2. Lưu Báo giá chính thức
          const res = await fetch("/api/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              buyer_name: info.name,
              buyer_phone: info.phone,
              model: config.model,
              version: pricing.version.label,
              color: pricing.color.label,
              battery: config.battery,
              province: pricing.province.label,
              accessories: config.accessories,
              price_snapshot: {
                base_price: pricing.basePrice,
                battery_cost: pricing.batteryPrice,
                acc_total: pricing.accTotal,
                rolling_total: pricing.rollingTotal,
                discount: pricing.discount,
                final_price: pricing.finalPrice,
              },
              price_version: "2025-Q4-v1",
              final_price: pricing.finalPrice,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Không thể tạo báo giá.");
          }
        }}
        finalPrice={pricing.finalPrice}
        carConfig={text}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><Quote /></Suspense>;
}
