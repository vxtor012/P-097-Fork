import { VEHICLES, PROVINCES, ACCESSORIES, VehicleKey } from "@/lib/vehicle-data";
import type { Config } from "@/hooks/use-configurator";

/** Đọc cấu hình xe từ URL (?model=VF6&version=..&color=..). Luôn trả về bộ giá trị hợp lệ. */
export function fromQuery(sp: { get(k: string): string | null }): Partial<Config> {
  const m = sp.get("model") as VehicleKey | null;
  if (!m || !(m in VEHICLES)) return {};
  const v = VEHICLES[m];
  const versionId = v.versions.find((x) => x.id === sp.get("version"))?.id ?? v.versions[v.versions.length - 1].id;
  const colorId = v.colors.find((x) => x.id === sp.get("color"))?.id ?? v.colors[0].id;
  const province = sp.get("province");
  const acc = (sp.get("acc") ?? "").split(",").filter((id) => ACCESSORIES.some((a) => a.id === id));
  return {
    model: m,
    versionId,
    colorId,
    battery: sp.get("battery") === "buy" ? "buy" : "rent",
    provinceId: province && province in PROVINCES ? province : "HN",
    accessories: acc,
  };
}

export function toQuery(c: Config): string {
  return new URLSearchParams({
    model: c.model, version: c.versionId, color: c.colorId,
    battery: c.battery, province: c.provinceId, acc: c.accessories.join(","),
  }).toString();
}
