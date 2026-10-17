"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { CarImage } from "@/components/shared/car-image";
import { Stepper } from "@/components/configurator/stepper";
import { useConfigurator } from "@/hooks/use-configurator";
import { useHydrated } from "@/hooks/use-hydrated";
import { fromQuery, toQuery } from "@/lib/config-url";
import { VEHICLES, type VehicleKey } from "@/lib/vehicle-data";
import { formatNumber } from "@/lib/format";

const CarViewer3D = dynamic(
  () =>
    import("@/components/configurator/car-viewer-3d").then(
      (module) => module.CarViewer3D
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[220px] w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#dce8ce] border-t-[#134c40]" />
      </div>
    ),
  }
);

function Customize() {
  const searchParams = useSearchParams();
  const configurator = useConfigurator(fromQuery(searchParams));
  const mounted = useHydrated();

  const {
    config,
    setField,
    selectModel,
    toggleAccessory,
    pricing,
    vehicle,
    vehicles,
    provinces,
    accessories,
    statusMessage,
    canQuote,
  } = configurator;

  const selectedVehicle = vehicle || VEHICLES[config.model];
  const query = toQuery(config);

  const optionClass = (selected: boolean) =>
    `w-full rounded-xl border p-4 text-left transition ${selected
      ? "border-[#458e73] bg-[#eff4ed] ring-2 ring-[#dce8ce]"
      : "border-[#172a27]/10 bg-white hover:border-[#458e73]/50 hover:bg-[#fdfcf8]"
    }`;

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] flex-col bg-[#f6f5f0]">
        <LandingNav />
        <Stepper current={1} />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#dce8ce] border-t-[#134c40]" />
        </main>
      </div>
    );
  }

  const backToModels = config.dealerId
    ? `/configurator?dealer=${encodeURIComponent(config.dealerId)}`
    : "/configurator";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f5f0] text-[#172a27]">
      <LandingNav />
      <Stepper current={1} query={query} />

      <main className="min-h-0 flex-1 overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_440px] xl:grid-rows-1 xl:overflow-hidden">
        <section className="sticky top-0 z-20 flex h-[35dvh] min-h-[245px] w-full flex-col overflow-hidden border-b border-[#172a27]/10 bg-[#f2f3eb] xl:relative xl:h-full xl:border-b-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_48%,#dce7dc_0%,#e8ede2_43%,#f2f3eb_72%)]" />
          <div className="pointer-events-none absolute right-[8%] top-[4%] aspect-square w-[72%] rounded-full border border-[#134c40]/10" />
          <div className="pointer-events-none absolute right-[14%] top-[10%] aspect-square w-[60%] rounded-full border border-[#134c40]/[0.07]" />

          <div className="relative z-10 flex items-start justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6 xl:px-10 xl:pt-8">
            <div>
              <Link
                href={backToModels}
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#577267] transition hover:text-[#134c40]"
              >
                <ChevronLeft size={15} />
                Chọn dòng xe khác
              </Link>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl xl:text-3xl">
                VinFast {selectedVehicle.label}
              </h1>
            </div>

            <span className="rounded-full border border-[#134c40]/10 bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#315548] backdrop-blur">
              {pricing.version.label}
            </span>
          </div>

          <span className="pointer-events-none absolute left-[8%] top-[22%] select-none text-[clamp(100px,18vw,250px)] font-bold leading-none tracking-[-.08em] text-[#5f8c72]/10">
            {selectedVehicle.label.replace(" ", "")}
          </span>

          <div className="relative z-10 min-h-0 flex-1">
            <CarViewer3D
              modelUrl={selectedVehicle.model3d}
              modelName={selectedVehicle.label}
              colorHex={pricing.color.hex}
              roofHex={
                pricing.color.roofHex ||
                pricing.color.roof_hex ||
                pricing.color.hex
              }
              className="h-full w-full"
              fallback2D={
                <CarImage
                  model={config.model}
                  colorId={config.colorId}
                  alt={`VinFast ${selectedVehicle.label}`}
                  maxWidth={760}
                  className="mx-auto"
                />
              }
            />
          </div>

          <div className="relative z-10 hidden items-center justify-between border-t border-[#172a27]/10 px-10 py-4 text-xs text-[#577267] xl:flex">
            <span>
              {pricing.color.label} <span className="px-2 text-[#9aa79c]">·</span>
              Pin {config.battery === "rent" ? "thuê" : "mua"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-[#458e73]" />
              Tùy chỉnh theo lựa chọn của bạn
            </span>
          </div>
        </section>

        <section className="min-h-0 space-y-7 px-5 py-6 sm:px-8 xl:overflow-y-auto xl:border-l xl:border-[#172a27]/10 xl:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#577267]">
              BƯỚC 2 · TÙY CHỈNH XE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Tạo cấu hình của bạn
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#69756d]">
              Chọn phiên bản và các tùy chọn để xem dự toán cập nhật.
            </p>
          </div>

          <Group title="Dòng xe">
            <select
              id="vehicle-model-select"
              aria-label="Chọn dòng xe"
              value={config.model}
              onChange={(event) =>
                selectModel(event.target.value as VehicleKey)
              }
              className="w-full rounded-xl border border-[#172a27]/15 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#458e73] focus:ring-2 focus:ring-[#458e73]/15"
            >
              {(Object.keys(vehicles) as VehicleKey[]).map((model) => (
                <option key={model} value={model}>
                  VinFast {vehicles[model].label}
                </option>
              ))}
            </select>
          </Group>

          <Group title="Phiên bản">
            <div className="space-y-2">
              {selectedVehicle.versions.map((version) => {
                const selected = version.id === config.versionId;

                return (
                  <button
                    key={version.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setField("versionId", version.id)}
                    className={optionClass(selected)}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#315548]">
                        {version.label}
                      </span>
                      <span className="text-sm font-semibold text-[#172a27]">
                        {formatNumber(version.price)} ₫
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Màu ngoại thất">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#315548]">
                {pricing.color.label}
              </span>
              <span className="text-xs text-[#89968e]">Đã gồm trong giá</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedVehicle.colors.map((color) => {
                const roof = color.roofHex || color.roof_hex;
                const twoTone = Boolean(
                  roof && roof.toLowerCase() !== color.hex.toLowerCase()
                );
                const background = twoTone
                  ? `linear-gradient(135deg, ${color.hex} 50%, ${roof} 50%)`
                  : color.hex;
                const selected = color.id === config.colorId;

                return (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={color.label}
                    aria-pressed={selected}
                    title={color.label}
                    onClick={() => setField("colorId", color.id)}
                    className={`grid h-10 w-10 place-items-center rounded-full border border-white transition ${selected
                      ? "scale-110 ring-2 ring-[#458e73] ring-offset-2"
                      : "shadow-sm hover:scale-105"
                      }`}
                    style={{ background }}
                  >
                    {selected && (
                      <Check
                        size={16}
                        className={
                          ["white", "yellow_white", "pink_white"].includes(
                            color.id
                          )
                            ? "text-[#315548]"
                            : "text-white"
                        }
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Pin">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={config.battery === "rent"}
                onClick={() => setField("battery", "rent")}
                disabled={!pricing.canRent}
                title={!pricing.canRent ? 'Chỉ dành cho hợp đồng thuê pin cũ đã xác minh' : undefined}
                className={optionClass(config.battery === "rent")}
              >
                <span className="block font-semibold text-[#315548]">
                  Thuê pin
                </span>
                <span className="mt-1 block text-sm text-[#69756d]">
                  {formatNumber(selectedVehicle.battery.rent)} ₫/tháng
                </span>
              </button>

              <button
                type="button"
                aria-pressed={config.battery === "buy"}
                onClick={() => setField("battery", "buy")}
                className={optionClass(config.battery === "buy")}
              >
                <span className="block font-semibold text-[#315548]">
                  Mua pin
                </span>
                <span className="mt-1 block text-sm text-[#69756d]">
                  +{formatNumber(selectedVehicle.battery.buy)} ₫
                </span>
              </button>
            </div>
          </Group>

          <Group title="Nơi đăng ký xe">
            <select
              value={config.provinceId}
              onChange={(event) =>
                setField("provinceId", event.target.value)
              }
              className="w-full rounded-xl border border-[#172a27]/15 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#458e73] focus:ring-2 focus:ring-[#458e73]/15"
            >
              {Object.entries(provinces).map(([id, province]) => (
                <option key={id} value={id}>
                  {province.label}
                </option>
              ))}
            </select>
          </Group>

          <Group title="Phụ kiện">
            <div className="space-y-2">
              {accessories.map((accessory) => {
                const selected = config.accessories.includes(accessory.id);

                return (
                  <button
                    key={accessory.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleAccessory(accessory.id)}
                    className={optionClass(selected)}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${selected
                            ? "border-[#134c40] bg-[#134c40] text-white"
                            : "border-[#172a27]/20 bg-white"
                            }`}
                        >
                          {selected && <Check size={13} />}
                        </span>
                        <span className="truncate font-medium text-[#315548]">
                          {accessory.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-[#69756d]">
                        {formatNumber(accessory.price)} ₫
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Link
            href={`/configurator/quote?${query}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#134c40] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1f6352] xl:hidden"
          >
            Xem báo giá
            <ArrowLeft className="rotate-180" size={17} />
          </Link>
        </section>
      </main>

      <footer className="z-30 flex-none border-t border-[#172a27]/10 bg-[#fdfcf8] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] sm:px-7 xl:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="hidden min-w-0 items-center gap-3 text-xs text-[#69756d] xl:flex">
            <span className="font-semibold text-[#315548]">
              VinFast {selectedVehicle.label} {pricing.version.label}
            </span>
            <span className="text-[#9aa79c]">·</span>
            <span>{pricing.color.label}</span>
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-3 sm:gap-5">
            <div className="min-w-0 text-right">
              <p className="truncate text-[10px] font-medium text-[#69756d] sm:text-xs">
                Dự tính lăn bánh
              </p>
              <p className="truncate text-lg font-bold leading-tight text-[#134c40] sm:text-2xl">
                {formatNumber(pricing.finalPrice)} ₫
              </p>
              <p
                role="status"
                className={`mt-1 max-w-[220px] truncate text-[10px] ${canQuote ? "text-[#458e73]" : "text-amber-700"
                  }`}
              >
                {statusMessage}
              </p>
            </div>

            <Link
              href={`/configurator/quote?${query}`}
              className="shrink-0 rounded-full bg-[#134c40] px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1f6352] sm:px-7 sm:text-sm"
            >
              <span className="sm:hidden">Báo giá</span>
              <span className="hidden sm:inline">Xem báo giá chi tiết</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-[#315548]">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#f6f5f0]">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#dce8ce] border-t-[#134c40]" />
        </div>
      }
    >
      <Customize />
    </Suspense>
  );
}
