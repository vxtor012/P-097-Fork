"use client";

import { VEHICLES, PROVINCES, ACCESSORIES, VehicleKey } from "@/lib/vehicle-data";
import { formatVND } from "@/lib/format";
import { useConfigurator } from "@/hooks/use-configurator";
import { MessageCircle, FileText, Check } from "lucide-react";

interface Props {
  configurator:    ReturnType<typeof useConfigurator>;
  onAskAI:         () => void;
  onRequestQuote:  () => void;
}

export function SelectorPanel({ configurator, onAskAI, onRequestQuote }: Props) {
  const { config, setField, toggleAccessory, pricing } = configurator;
  const vehicle = VEHICLES[config.model];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* 1. Model */}
        <Section title="1. Chọn dòng xe">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(VEHICLES) as VehicleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setField("model", key)}
                className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                  config.model === key
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {VEHICLES[key].label}
              </button>
            ))}
          </div>
        </Section>

        {/* 2. Phiên bản */}
        <Section title="2. Phiên bản">
          <div className="space-y-2">
            {vehicle.versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setField("versionId", v.id)}
                className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border text-sm transition-all ${
                  config.versionId === v.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={config.versionId === v.id ? "font-semibold text-blue-700" : "text-gray-700"}>
                  {v.label}
                </span>
                <span className={`text-xs font-medium ${config.versionId === v.id ? "text-blue-600" : "text-gray-500"}`}>
                  {formatVND(v.price)}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* 3. Màu */}
        <Section title="3. Màu sắc">
          <div className="space-y-2">
            {vehicle.colors.map((c) => (
              <button
                key={c.id}
                onClick={() => setField("colorId", c.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  config.colorId === c.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: c.hex }} />
                <span className={`text-sm ${config.colorId === c.id ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                  {c.label}
                </span>
                {config.colorId === c.id && <Check size={14} className="ml-auto text-blue-600 shrink-0" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </Section>

        {/* 4. Tỉnh */}
        <Section title="4. Tỉnh / Thành phố">
          <select
            value={config.provinceId}
            onChange={(e) => setField("provinceId", e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {Object.entries(PROVINCES).map(([id, p]) => (
              <option key={id} value={id}>{p.label}</option>
            ))}
          </select>
        </Section>

        {/* 5. Pin */}
        <Section title="5. Gói pin">
          <div className="grid grid-cols-2 gap-2">
            {([
              { val: "rent", label: "Thuê pin", sub: `${formatVND(vehicle.battery.rent)}/tháng` },
              { val: "buy",  label: "Mua pin",  sub: vehicle.battery.buy > 0 ? formatVND(vehicle.battery.buy) : "Tích hợp sẵn" },
            ] as const).map((opt) => (
              <button
                key={opt.val}
                onClick={() => setField("battery", opt.val)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  config.battery === opt.val
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className={`text-sm font-medium ${config.battery === opt.val ? "text-blue-700" : "text-gray-700"}`}>
                  {opt.label}
                </p>
                <p className={`text-xs mt-0.5 ${config.battery === opt.val ? "text-blue-500" : "text-gray-400"}`}>
                  {opt.sub}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* 6. Phụ kiện */}
        <Section title="6. Phụ kiện">
          <div className="space-y-2">
            {ACCESSORIES.map((acc) => {
              const checked = config.accessories.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => toggleAccessory(acc.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    checked ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                      {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm ${checked ? "text-blue-700 font-medium" : "text-gray-700"}`}>
                      {acc.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">+{formatVND(acc.price)}</span>
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t bg-white space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Giá lăn bánh dự tính</span>
          <span className="text-lg font-bold text-blue-700">{formatVND(pricing.finalPrice)}</span>
        </div>
        <button
          onClick={onAskAI}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium text-sm transition-colors"
        >
          <MessageCircle size={15} /> Hỏi AI về cấu hình này
        </button>
        <button
          onClick={onRequestQuote}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
        >
          <FileText size={15} /> Yêu cầu báo giá chính thức
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}
