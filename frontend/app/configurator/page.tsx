import Link from "next/link";
import { CarImage } from "@/components/shared/car-image";
import { SiteNav } from "@/components/shared/site-nav";
import { Stepper } from "@/components/configurator/stepper";
import { VEHICLES, VehicleKey } from "@/lib/vehicle-data";
import { formatNumber } from "@/lib/format";

export default function ChooseModel() {
  const keys = Object.keys(VEHICLES) as VehicleKey[];
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <Stepper current={0} />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-4">
        <h1 className="text-3xl font-bold text-slate-900">Bạn muốn cấu hình dòng xe nào?</h1>
        <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3">
          {keys.map((k) => {
            const v = VEHICLES[k];
            return (
              <Link key={k} href={`/configurator/customize?model=${k}`} className="rounded-3xl border border-slate-200 p-5 transition hover:border-blue-600 hover:shadow-lg">
                <CarImage model={k} colorId={v.colors[0].id} alt={v.label} />
                <p className="mt-3 text-xl font-bold text-slate-900">{v.label}</p>
                <p className="text-sm text-slate-500">{v.versions.length} phiên bản · {v.colors.length} màu · từ {formatNumber(Math.min(...v.versions.map((x) => x.price)))}đ</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
