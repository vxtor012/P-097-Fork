"use client";

import { BRAND } from "@/lib/brand";
import { Suspense, useState, useRef } from "react";
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
import { readApiError } from "@/lib/catalog-api";
import { formatVND } from "@/lib/format";
import { InstallmentEstimator } from '@/components/configurator/installment-estimator';

function Quote() {
  const configurator = useConfigurator(fromQuery(useSearchParams()));
  const { config, setField, pricing, vehicle, dealers, dealerError, canQuote, statusMessage, pricingRequest, refreshPricing } = configurator;
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPreviewPdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch("/api/quote/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingRequest),
      });

      if (!res.ok) throw new Error("Không thể tạo PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${BRAND.name}_BaoGia_${config.model}_${pricing.version.label}.pdf`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
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
            imageUrl={pricing.color?.imageUrl || pricing.color?.image_url}
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
          <p role="status" className={`mt-2 text-xs ${canQuote ? "text-emerald-700" : "text-amber-700"}`}>{statusMessage}</p>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {rows.map(([k, n]) => (
              <div key={k} className="flex justify-between py-3"><dt className="text-slate-600">{k}</dt><dd className="font-medium text-slate-900">{formatVND(n)}</dd></div>
            ))}
            {pricing.promos.map((p) => (
              <div key={p.name} className="flex justify-between py-3 text-green-700"><dt>{p.name} <span className="text-slate-400">({p.source})</span></dt><dd className="font-medium">-{formatVND(p.value)}</dd></div>
            ))}
          </dl>
          {pricing.promotionDecisions.filter((d) => d.state === 'eligible_pending_verification').map((d) =>
            <p key={d.id} className="mb-2 text-xs text-amber-800">{d.name}: chưa trừ tiền. Cần xác minh: {d.verification_requirements.map((r) => r.document).join('; ')}.</p>)}
          <div className="mt-2 flex items-end justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-sm text-white/70">Tổng dự tính</span><span className="text-2xl font-bold">{formatVND(pricing.finalPrice)}</span>
          </div>
          <div className="mt-5 space-y-2.5">
            <label className="block text-sm font-medium text-slate-700">Đại lý nhận yêu cầu
              <select value={config.dealerId} onChange={(e) => setField('dealerId', e.target.value)} required className="mt-2 w-full rounded-xl border p-3">
                <option value="">Chọn đại lý</option>
                {dealers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.province}</option>)}
              </select>
            </label>
            {dealerError && <p role="alert" className="text-xs text-red-600">{dealerError}</p>}
            <button
              onClick={() => setOpen(true)}
              disabled={!canQuote || !config.dealerId}
              className="w-full disabled:opacity-50 rounded-full bg-blue-600 py-3.5 font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              Yêu cầu báo giá chính thức
            </button>
            <button
              onClick={downloadPreviewPdf}
              disabled={downloadingPdf || !canQuote}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-blue-600 py-3 font-semibold text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              <span>{downloadingPdf ? "Đang tạo PDF..." : "Tải dự toán PDF"}</span>
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Giá chỉ mang tính tham khảo. Báo giá chính thức do tư vấn viên của đại lý xác nhận.</p>
          <InstallmentEstimator configurator={configurator} />
        </section>

      </main>
      <BuyerIdentityModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={async (info) => {
          if (!canQuote || !config.dealerId) throw new Error('Hãy chọn đại lý và chờ xác nhận giá hiện hành.');
          // Backend creates the lead and quote in one transaction.
          const payload = { ...pricingRequest,
            buyer_name: info.name, buyer_phone: info.phone, note: info.note,
            price_version: pricing.priceVersion, final_price: pricing.finalPrice, pricing_hash: pricing.pricingHash };
          const fingerprint = JSON.stringify(payload);
          if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
          const res = await fetch('/api/quotes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, request_id: requestRef.current.id }),
          });

          if (!res.ok) {
            if (res.status === 409) await refreshPricing();
            throw new Error(await readApiError(res, "Không thể tạo báo giá."));
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
