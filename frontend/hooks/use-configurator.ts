"use client";

import { useState, useMemo, useEffect } from "react";
import { VEHICLES, PROVINCES, ACCESSORIES, VehicleKey } from "@/lib/vehicle-data";

export interface Config {
  model:       VehicleKey;
  versionId:   string;
  colorId:     string;
  provinceId:  string;
  battery:     "buy" | "rent";
  accessories: string[];
}

export function useConfigurator(initial: Partial<Config> = {}) {
  const [vehicles, setVehicles] = useState(VEHICLES);
  const [config, setConfig] = useState<Config>(() => {
    const defaultModel = initial.model ?? "VF6";
    const v = VEHICLES[defaultModel] ?? VEHICLES["VF6"];
    return {
      model:       defaultModel,
      versionId:   initial.versionId ?? v.versions[0].id,
      colorId:     initial.colorId ?? v.colors[0].id,
      provinceId:  initial.provinceId ?? "HN",
      battery:     initial.battery ?? "rent",
      accessories: initial.accessories ?? [],
    };
  });

  // Sync vehicles dynamically from backend API
  useEffect(() => {
    let cancelled = false;
    fetch("/api/vehicles")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.vehicles && Object.keys(data.vehicles).length > 0) {
          setVehicles((prev) => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(data.vehicles)) {
              if (key in next) {
                next[key as VehicleKey] = {
                  ...next[key as VehicleKey],
                  ...(val as any),
                };
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        // Fallback to static VEHICLES
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initial.model && initial.model !== config.model) {
      const v = vehicles[initial.model] ?? VEHICLES[initial.model];
      if (v) {
        setConfig((prev) => ({
          ...prev,
          model: initial.model!,
          versionId: initial.versionId ?? v.versions[0].id,
          colorId: initial.colorId ?? v.colors[0].id,
          battery: initial.battery ?? prev.battery,
          provinceId: initial.provinceId ?? prev.provinceId,
          accessories: initial.accessories ?? prev.accessories,
        }));
      }
    }
  }, [initial.model, initial.versionId, initial.colorId, vehicles]);

  // Ensure current selection is valid when vehicles list updates
  useEffect(() => {
    const v = vehicles[config.model];
    if (v) {
      const hasVersion = v.versions.some((ver) => ver.id === config.versionId);
      const hasColor = v.colors.some((col) => col.id === config.colorId);
      if (!hasVersion || !hasColor) {
        setConfig((prev) => ({
          ...prev,
          versionId: hasVersion ? prev.versionId : v.versions[0].id,
          colorId: hasColor ? prev.colorId : v.colors[0].id,
        }));
      }
    }
  }, [vehicles, config.model]);

  const setField = <K extends keyof Config>(key: K, val: Config[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: val };
      // Reset version và color khi đổi model
      if (key === "model") {
        const v = vehicles[val as VehicleKey] ?? VEHICLES[val as VehicleKey];
        if (v) {
          next.versionId = v.versions[0].id;
          next.colorId   = v.colors[0].id;
        }
      }
      return next;
    });
  };

  const toggleAccessory = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      accessories: prev.accessories.includes(id)
        ? prev.accessories.filter((a) => a !== id)
        : [...prev.accessories, id],
    }));
  };

  // ── Tính giá DETERMINISTIC ──────────────────────────────────
  const vehicle = vehicles[config.model] ?? VEHICLES[config.model];

  const pricing = useMemo(() => {
    const v = vehicles[config.model] ?? VEHICLES[config.model];
    const version  = v.versions.find((ver) => ver.id === config.versionId) ?? v.versions[0];
    const province = PROVINCES[config.provinceId] ?? PROVINCES["HN"];
    const color    = v.colors.find((col) => col.id === config.colorId) ?? v.colors[0];

    const basePrice    = version.price;
    const batteryPrice = config.battery === "buy" ? v.battery.buy : 0;
    const batteryRent  = config.battery === "rent" ? v.battery.rent : 0;

    const accList = ACCESSORIES.filter((a) => config.accessories.includes(a.id));
    const accTotal = accList.reduce((s, a) => s + a.price, 0);

    // Phí lăn bánh
    const registrationFee = Math.round(basePrice * province.registrationRate);
    const roadFee         = 1560000;
    const inspectionFee   = 340000;
    const insuranceFee    = Math.round(basePrice * 0.015);
    const plateFee        = province.plateFee;

    const rollingTotal = registrationFee + roadFee + inspectionFee + insuranceFee + plateFee;

    // Mock khuyến mãi
    const promos = [
      { name: "Ưu đãi tháng 10", value: 30000000, source: "VinFast toàn quốc" },
    ];
    const discount = promos.reduce((s, p) => s + p.value, 0);

    const subtotal   = basePrice + batteryPrice + accTotal;
    const finalPrice = subtotal + rollingTotal - discount;

    return {
      basePrice,
      batteryPrice,
      batteryRent,
      accList,
      accTotal,
      registrationFee,
      roadFee,
      inspectionFee,
      insuranceFee,
      plateFee,
      rollingTotal,
      promos,
      discount,
      subtotal,
      finalPrice,
      color,
      version,
      province,
    };
  }, [config, vehicles]);

  return { config, setField, toggleAccessory, pricing, vehicles, vehicle };
}
