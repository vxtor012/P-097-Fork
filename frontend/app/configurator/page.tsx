import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { CarImage } from "@/components/shared/car-image";
import { Stepper } from "@/components/configurator/stepper";
import { VEHICLES, type VehicleKey } from "@/lib/vehicle-data";

export default function ConfiguratorPage() {
    const models = Object.keys(VEHICLES) as VehicleKey[];

    return (
        <div className="min-h-screen bg-[#f6f5f0] text-[#172a27]">
            <LandingNav />
            <Stepper current={0} />

            <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
                <header className="mb-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#577267]">
                        BƯỚC 1 · CHỌN DÒNG XE
                    </p>
                    <h1 className="mt-2 text-3xl font-medium tracking-[-.04em] sm:text-4xl">
                        Bạn muốn bắt đầu với chiếc xe nào?
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69756d]">
                        Chọn một dòng xe để xem phiên bản, màu sắc và tạo cấu hình phù hợp
                        với nhu cầu của bạn.
                    </p>
                </header>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {models.map((model) => {
                        const vehicle = VEHICLES[model];

                        return (
                            <Link
                                key={model}
                                href={`/configurator/customize?model=${model}`}
                                className="group overflow-hidden rounded-2xl border border-[#172a27]/10 bg-[#fdfcf8] transition hover:-translate-y-1 hover:border-[#458e73]/50 hover:shadow-lg"
                            >
                                <div className="bg-[#e8eee3] px-5 pt-5">
                                    <CarImage
                                        model={model}
                                        colorId={vehicle.colors[0].id}
                                        alt={`VinFast ${vehicle.label}`}
                                        maxWidth={520}
                                        className="mx-auto"
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-4 p-5">
                                    <div>
                                        <p className="text-xs text-[#89968e]">VinFast</p>
                                        <h2 className="mt-1 text-xl font-semibold text-[#172a27]">
                                            {vehicle.label}
                                        </h2>
                                        <p className="mt-1 text-sm text-[#69756d]">
                                            {vehicle.versions.length} phiên bản
                                        </p>
                                    </div>

                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#134c40] text-white transition group-hover:bg-[#1f6352]">
                                        <ArrowUpRight size={18} />
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}