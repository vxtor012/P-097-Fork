import { VEHICLES, VehicleKey } from "@/lib/vehicle-data";
import type { Config } from "@/hooks/use-configurator";

/** Đọc cấu hình xe từ URL (?model=VF6&version=..&color=..). Luôn trả về bộ giá trị hợp lệ. */
export function fromQuery(sp: { get(k: string): string | null }): Partial<Config> {
  const m = sp.get("model")?.replace(/\s/g, '').toUpperCase() as VehicleKey | undefined;
  if (!m || !(m in VEHICLES)) return {
    battery: sp.get("battery") === "buy" ? "buy" : "rent",
    provinceId: sp.get("province") || "HN",
    dealerId: sp.get("dealer") ?? "",
  };
  const v = VEHICLES[m];
  const versionId = sp.get("version") || v.versions[v.versions.length - 1].id;
  const colorId = sp.get("color") || v.colors[0].id;
  const province = sp.get("province");
  const acc = (sp.get("acc") ?? sp.get("accessories") ?? "").split(",").filter(Boolean);
  return {
    model: m,
    versionId,
    colorId,
    battery: sp.get("battery") === "buy" ? "buy" : "rent",
    provinceId: province || "HN",
    accessories: acc,
    dealerId: sp.get('dealer') ?? '',
  };
}

export function toQuery(c: Config): string {
  return new URLSearchParams({
    model: c.model, version: c.versionId, color: c.colorId,
    battery: c.battery, province: c.provinceId, acc: c.accessories.join(","), dealer: c.dealerId,
  }).toString();
}
