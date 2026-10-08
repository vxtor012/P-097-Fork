"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
          <button onClick={() => setOpen(true)} className="mt-5 w-full rounded-full bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700">Yêu cầu báo giá chính thức</button>
          <p className="mt-3 text-xs text-slate-500">Giá chỉ mang tính tham khảo. Báo giá chính thức do tư vấn viên của đại lý xác nhận.</p>
        </section>
      </main>
      <BuyerIdentityModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={(info) => { console.log("Lead info:", info); /* TODO: POST /api/v1/quotes */ }}
        finalPrice={pricing.finalPrice}
        carConfig={text}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><Quote /></Suspense>;
}
