import Link from "next/link";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Chọn dòng xe", path: "/configurator" },
  { label: "Tuỳ chỉnh xe", path: "/configurator/customize" },
  { label: "Báo giá & tư vấn", path: "/configurator/quote" },
];

export function Stepper({ current, query = "" }: { current: 0 | 1 | 2; query?: string }) {
  return (
    <nav aria-label="Progress" className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-2.5 sm:px-6 sm:py-3.5">
        <div className="relative">
          {/* Connector Line behind steps */}
          <div
            aria-hidden="true"
            className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-slate-200"
          />

          <ol className="relative grid grid-cols-3 items-center text-xs sm:text-sm">
            {STEPS.map((s, i) => {
              const done = i < current;
              const isCurrent = i === current;

              const alignClass =
                i === 0
                  ? "justify-start text-left"
                  : i === 1
                  ? "justify-center text-center"
                  : "justify-end text-right";

              const paddingClass =
                i === 0
                  ? "pr-2 sm:pr-3"
                  : i === 1
                  ? "px-2 sm:px-3"
                  : "pl-2 sm:pl-3";

              const isStep3 = i === 2;

              const body = (
                <span
                  className={`inline-flex items-center gap-1.5 sm:gap-2.5 whitespace-nowrap bg-white ${paddingClass} ${
                    isCurrent
                      ? "font-semibold text-blue-600"
                      : done
                      ? "text-slate-700 hover:text-slate-900"
                      : "text-slate-400"
                  } ${isStep3 ? "max-sm:flex-row-reverse" : ""}`}
                >


                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-100"
                        : done
                        ? "bg-slate-800 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap ${
                      isCurrent ? "inline" : "hidden sm:inline"
                    }`}
                  >
                    {s.label}
                  </span>
                </span>
              );

              return (
                <li key={s.path} className={`flex items-center ${alignClass}`}>
                  {done ? (
                    <Link
                      href={query && i > 0 ? `${s.path}?${query}` : s.path}
                      className="transition-opacity hover:opacity-80"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}
