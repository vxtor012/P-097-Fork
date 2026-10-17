"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VEHICLES, PROVINCES, ACCESSORIES, type Vehicle, type VehicleKey } from "@/lib/vehicle-data";
import { fetchCatalog, fetchDealers, readApiError, type CatalogAccessory, type Province, type ServerPricing } from "@/lib/catalog-api";
import { getQueryClient } from "@/lib/query-client";
import type { ConfigurationUpdate } from './use-chat';
import { ensureCustomerSession } from '@/lib/customer-session';

export interface Config {
  model: VehicleKey;
  versionId: string;
  colorId: string;
  provinceId: string;
  battery: "buy" | "rent";
  accessories: string[];
  dealerId: string;
}

function getAllowedColors(vehicle: Vehicle, version: Vehicle["versions"][number]) {
  return vehicle.colors.filter((color) => !version.colorPrices || color.label in version.colorPrices);
}

/** Keep bookmarked and in-progress selections valid when the live catalog arrives or changes. */
function resolveSelection(
  selection: Config,
  vehicles: Record<VehicleKey, Vehicle>,
  provinces: Record<string, Province>,
  accessories: CatalogAccessory[],
): Config {
  const vehicle = vehicles[selection.model];
  const oldVehicle = VEHICLES[selection.model];
  const oldVersion = oldVehicle.versions.find((version) => version.id === selection.versionId);
  const version = vehicle.versions.find((version) =>
    version.id === selection.versionId || version.label === oldVersion?.label) ?? vehicle.versions[0];
  const colors = getAllowedColors(vehicle, version);
  const oldColor = oldVehicle.colors.find((color) => color.id === selection.colorId);
  const color = colors.find((color) => color.id === selection.colorId ||
    color.label === selection.colorId || color.label === oldColor?.label) ?? colors[0] ?? vehicle.colors[0];
  const provinceId = selection.provinceId in provinces ? selection.provinceId
    : Object.keys(provinces).find((id) => provinces[id].label === PROVINCES[selection.provinceId]?.label)
      ?? Object.keys(provinces)[0] ?? "HN";
  const accessoryIds = new Set(accessories.filter((accessory) => !accessory.compatibleModels.length ||
    accessory.compatibleModels.includes(selection.model)).map((accessory) => accessory.id));

  return { ...selection, versionId: version.id, colorId: color.id, provinceId,
    accessories: [...new Set(selection.accessories)].filter((id) => accessoryIds.has(id)) };
}

export function useConfigurator(initial: Partial<Config> = {}) {
  const customerSession = useQuery({ queryKey: ['customer-session'], queryFn: ensureCustomerSession,
    staleTime: Infinity, retry: 1 }, getQueryClient());
  const catalog = useQuery({
    queryKey: ["vehicle-catalog"], queryFn: fetchCatalog,
    staleTime: 0, refetchInterval: 30000, retry: 1,
  }, getQueryClient());
  const vehicles = { ...VEHICLES, ...catalog.data?.vehicles };
  const dealerQuery = useQuery({ queryKey: ['dealer-options'], queryFn: fetchDealers, retry: 1,
    refetchInterval: 30000 }, getQueryClient());
  const provinces = catalog.data?.provinces ?? PROVINCES;
  const accessories = catalog.data?.accessories ?? ACCESSORIES.map((a) => ({ ...a, compatibleModels: [] as string[] }));
  const [selection, setConfig] = useState<Config>(() => {
    const model = initial.model ?? "VF6";
    const v = VEHICLES[model];
    return { model, versionId: initial.versionId ?? v.versions[0].id,
      colorId: initial.colorId ?? v.colors[0].id, provinceId: initial.provinceId ?? "HN",
      battery: initial.battery ?? "buy", accessories: initial.accessories ?? [], dealerId: initial.dealerId ?? '' };
  });
  const switchModel = (previous: Config, model: VehicleKey): Config => {
    if (!vehicles[model]) return previous;
    const next = vehicles[model];
    const firstVersion = next.versions[0];
    const firstColor = getAllowedColors(next, firstVersion)[0] ?? next.colors[0];
    return resolveSelection({ ...previous, model, versionId: firstVersion.id, colorId: firstColor.id },
      vehicles, provinces, accessories);
  };
  const [initialModel, setInitialModel] = useState(initial.model);
  if (initial.model !== initialModel) {
    setInitialModel(initial.model);
    if (initial.model) {
      setConfig(resolveSelection({ ...switchModel(selection, initial.model), ...initial },
        vehicles, provinces, accessories));
    }
  }
  const config = resolveSelection(selection, vehicles, provinces, accessories);
  const vehicle = vehicles[config.model];
  const version = vehicle.versions.find((version) => version.id === config.versionId)!;
  const allowedColors = getAllowedColors(vehicle, version);
  const color = vehicle.colors.find((color) => color.id === config.colorId)!;
  const provinceId = config.provinceId;
  const province = provinces[provinceId] ?? PROVINCES.HN;
  const availableAccessories = accessories.filter((a) => !a.compatibleModels.length || a.compatibleModels.includes(config.model));
  const request = { model: config.model, version: version.label, color: color.label,
    province: province.label, battery: config.battery, accessories: config.accessories,
    dealer_id: config.dealerId || null, session_id: customerSession.data };
  const requestKey = JSON.stringify(request);
  const serverPrice = useQuery({
    queryKey: ["configuration-price", requestKey],
    enabled: !!customerSession.data && !!catalog.data?.vehicles[config.model] && !!catalog.data?.provinces[provinceId],
    queryFn: async ({ signal }): Promise<ServerPricing> => {
      const res = await fetch("/api/configurate", { method: "POST", signal,
        headers: { "Content-Type": "application/json" }, body: requestKey });
      if (!res.ok) throw new Error(await readApiError(res, "Không xác nhận được giá hiện hành."));
      return res.json();
    }, staleTime: 0, refetchInterval: 15000, retry: false,
  }, getQueryClient());
  const authoritative = !!serverPrice.data && !serverPrice.isError && !catalog.isError &&
    !!catalog.data?.vehicles[config.model] && !serverPrice.isFetching;
  const live = serverPrice.data;
  const accList = live?.accessories.map((a) => ({ id: a.code, label: a.name, price: a.price }))
    ?? availableAccessories.filter((a) => config.accessories.includes(a.id));
  const basePrice = live?.base_price ?? version.colorPrices?.[color.label] ?? version.price;
  const batteryPrice = live?.battery_cost ?? (config.battery === "buy" ? vehicle.battery.buy : 0);
  const accTotal = accList.reduce((sum, a) => sum + a.price, 0);
  // Fallback is explicitly labelled and cannot be submitted or exported.
  const registrationFee = live?.rolling_costs.registration_fee ?? Math.floor(basePrice * province.registrationRate);
  const roadFee = live?.rolling_costs.road_fee ?? 1560000;
  const inspectionFee = live?.rolling_costs.inspection_fee ?? 340000;
  const insuranceFee = live?.rolling_costs.insurance ?? Math.floor(basePrice * 0.015);
  const plateFee = live?.rolling_costs.plate_fee ?? province.plateFee;
  const rollingTotal = registrationFee + roadFee + inspectionFee + insuranceFee + plateFee;
  const promos = live?.promotions ?? [];
  const discount = live?.total_discount ?? 0;
  const subtotal = basePrice + batteryPrice + accTotal;
  const pricing = { basePrice, batteryPrice, batteryRent: live?.battery_rent ?? vehicle.battery.rent,
    accList, accTotal, registrationFee, roadFee, inspectionFee, insuranceFee, plateFee,
    rollingTotal, promos, discount, subtotal, finalPrice: live?.final_price ?? subtotal + rollingTotal,
    color, version, province, priceVersion: live?.price_version, calculatedAt: live?.calculated_at,
    source: authoritative ? "database" : "fallback", disclaimer: live?.disclaimer,
    pricingHash: live?.pricing_hash, promotionDecisions: live?.promotion_decisions ?? [],
    canRent: !serverPrice.isError && live?.battery_options?.rent === true };
  const statusMessage = authoritative
    ? `Giá hiện hành · ${live?.price_version} · ${live?.calculated_at ? new Date(live.calculated_at).toLocaleString("vi-VN") : ""}`
    : catalog.isPending || serverPrice.isFetching
      ? "Đang xác nhận dữ liệu và giá hiện hành…"
      : `${live ? "Đang hiển thị lần xác nhận giá trước đó." : "Đang dùng dữ liệu dự phòng để xem cấu hình."} ${serverPrice.error?.message ?? "Chưa xác nhận được báo giá hiện hành."}`;
  const selectModel = (model: VehicleKey) => {
    setConfig((previous) => previous.model === model ? previous : switchModel(previous, model));
  };
  const setField = <K extends keyof Config>(key: K, value: Config[K]) => {
    if (key === "model") {
      selectModel(value as VehicleKey);
      return;
    }
    setConfig((prev) => {
      return resolveSelection({ ...prev, [key]: value }, vehicles, provinces, accessories);
    });
  };
  const toggleAccessory = (id: string) => setConfig((previous) => {
    const current = resolveSelection(previous, vehicles, provinces, accessories);
    return resolveSelection({ ...current,
      accessories: current.accessories.includes(id) ? current.accessories.filter((accessory) => accessory !== id)
        : [...current.accessories, id] }, vehicles, provinces, accessories);
  });
  const applyConfiguration = (update: ConfigurationUpdate, expected: Config) => {
    const model = update.model.replace(/\s/g, '').toUpperCase() as VehicleKey;
    const target = catalog.data?.vehicles[model];
    const version = target?.versions.find((v) => v.label === update.version);
    const color = target?.colors.find((c) => c.label === update.color);
    const province = Object.keys(provinces).find((key) => provinces[key].label === update.province);
    if (!target || !version || !color || !province || !getAllowedColors(target, version).includes(color)) return;
    const signature = (c: Config) => JSON.stringify([c.model, c.versionId, c.colorId, c.provinceId, c.battery, c.accessories, c.dealerId]);
    setConfig((previous) => {
      const current = resolveSelection(previous, vehicles, provinces, accessories);
      if (signature(current) !== signature(expected)) return previous;
      return resolveSelection({ model, versionId: version.id, colorId: color.id, provinceId: province,
        battery: update.battery, accessories: update.accessories, dealerId: update.dealer_id ?? '' },
      vehicles, provinces, accessories);
    });
  };
  return { config, selectModel, setField, toggleAccessory, pricing, vehicles, vehicle: { ...vehicle, colors: allowedColors }, provinces,
    dealers: dealerQuery.data ?? [], dealerError: dealerQuery.error?.message,
    accessories: availableAccessories, canQuote: authoritative, statusMessage, pricingRequest: request,
    refreshPricing: serverPrice.refetch, applyConfiguration };
}
