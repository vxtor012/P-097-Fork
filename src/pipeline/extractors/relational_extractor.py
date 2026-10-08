"""
Extractor for relational vehicle pricing and rolling cost snapshot.
Transforms complex nested JSON into structured SilverVehicle records and knowledge markdown.
"""

import json
import logging
import re
from collections.abc import Generator
from datetime import UTC
from pathlib import Path
from typing import Any

from ..models.schemas import BronzeDocument, SilverVehicle
from .base import BaseExtractor

logger = logging.getLogger(__name__)

# VinFast Official Colors Mapping (Code -> (Standard Hex, Vietnamese Name))
VINFAST_COLOR_PALETTE: dict[str, tuple[str, str]] = {
    "CE18": ("#FFFFFF", "Trắng Tinh Khôi (Infinity Blanc)"),
    "CE11": ("#1A1A1A", "Đen Huyền Bí (Jet Black)"),
    "CE1V": ("#5F6363", "Xám Tinh Tế (Zenith Grey)"),
    "CE1W": ("#7CB3A3", "Xanh Bạc Hà (Urban Mint)"),
    "CE2Q": ("#A31F2A", "Đỏ Năng Lượng (Solar Ruby)"),
    "CE1M": ("#BA0C2F", "Đỏ Thẫm Quý Phái (Crimson Red)"),
    "CE22": ("#2E4D38", "Xanh Rêu Đậm (Ivy Green)"),
    "CE17": ("#C0C0C0", "Bạc Ánh Kim (Desat Silver)"),
    "CE1U": ("#F5B800", "Vàng Nắng Hè (Summer Yellow)"),
    "CE2G": ("#4A90D9", "Xanh Cổng Trời (Sky Blue)"),
    "CE21": ("#E8A2A8", "Hồng Mơ Mộng (Rose Pink)"),
    "CE2T": ("#D4B996", "Be Cát Tường (Be Pebble)"),
    "CE2I": ("#20B2AA", "Xanh Ngọc Bích (Tropical Jade)"),
    "CE2K": ("#C7737C", "Hồng Ánh Kim (Rose Metallic)"),
    "CE32": ("#E85D04", "Cam Năng Động (Vitality Orange)"),
    "CE33": ("#1D70B8", "Xanh Sao Trời (Starburst Blue)"),
    "CE2J": ("#1A365D", "Xanh Đại Dương (Moonlit Ocean)"),
    "CE2N": ("#5C4033", "Nâu Trầm Trí Tuệ (Introspective Brown)"),
    "CE31": ("#4A5568", "Xám Tàng Hình (Stealth Gray)"),
    "CE2O": ("#4B0082", "Tím Huyền Ảo (Mysterioso Purple)"),
    # Dual-tone (Phối 2 màu nóc thời thượng)
    "1821": ("#E8A2A8", "Hồng nóc Trắng (Rose Pink - Infinity Blanc Roof)"),
    "181U": ("#F5B800", "Vàng nóc Trắng (Summer Yellow - Infinity Blanc Roof)"),
    "181Y": ("#4A90D9", "Xanh Cổng Trời nóc Trắng (Sky Blue - Infinity Blanc Roof)"),
    "111U": ("#F5B800", "Vàng nóc Đen (Summer Yellow - Jet Black Roof)"),
    "182K": ("#C7737C", "Hồng Ánh Kim nóc Trắng (Rose Metallic - Infinity Blanc Roof)"),
    "1P2K": ("#C7737C", "Hồng Ánh Kim nóc Xanh (Rose Metallic - Aqua Blue Roof)"),
    "182I": ("#20B2AA", "Xanh Ngọc nóc Trắng (Tropical Jade - Infinity Blanc Roof)"),
    "1U2I": ("#20B2AA", "Xanh Ngọc nóc Vàng (Tropical Jade - Summer Yellow Roof)"),
    "182Q": ("#A31F2A", "Đỏ Ruby nóc Trắng (Solar Ruby - Infinity Blanc Roof)"),
    "1U11": ("#1A1A1A", "Đen nóc Vàng (Jet Black - Summer Yellow Roof)"),
    "1117": ("#C0C0C0", "Bạc Ánh Kim nóc Đen (Desat Silver - Jet Black Roof)"),
    "1832": ("#E85D04", "Cam nóc Trắng (Vitality Orange - Infinity Blanc Roof)"),
    "1833": ("#1D70B8", "Xanh Sao Trời nóc Trắng (Starburst Blue - Infinity Blanc Roof)"),
    "112Q": ("#A31F2A", "Đỏ Ruby nóc Đen (Solar Ruby - Jet Black Roof)"),
    "3111": ("#1A1A1A", "Đen nóc Xám (Jet Black - Stealth Gray Roof)"),
    "1132": ("#E85D04", "Cam nóc Đen (Vitality Orange - Jet Black Roof)"),
    "312O": ("#4B0082", "Tím nóc Xám (Mysterioso Purple - Stealth Gray Roof)"),
    "171V": ("#5F6363", "Xám nóc Bạc (Zenith Grey - Desat Silver Roof)"),
    "1V18": ("#FFFFFF", "Trắng nóc Xám (Infinity Blanc - Zenith Grey Roof)"),
    "2927": ("#7A1C29", "Đỏ Đậm nóc Đồng (Crimson Velvet - Mystery Bronze Roof)"),
    "2911": ("#1A1A1A", "Đen nóc Đồng (Jet Black - Mystery Bronze Roof)"),
}


def normalize_color_attributes(color_code: str, raw_data: dict[str, Any]) -> dict[str, Any]:
    """Normalizes color code, hex value, Vietnamese name, and image asset."""
    raw_label = raw_data.get("label", color_code)
    raw_hex = raw_data.get("code", "")
    color_roof = raw_data.get("colorRoofRefTo") or ""
    available = raw_data.get("available", True)

    image_obj = raw_data.get("image", {})
    image_url = ""
    if isinstance(image_obj, dict):
        image_url = image_obj.get("absURL") or image_obj.get("url") or ""

    if color_code in VINFAST_COLOR_PALETTE:
        std_hex, vi_name = VINFAST_COLOR_PALETTE[color_code]
    else:
        std_hex = raw_hex if (raw_hex and raw_hex.startswith("#") and len(raw_hex) in (4, 7)) else "#888888"
        vi_name = raw_label

    return {
        "color_code": color_code,
        "color_name": raw_label,
        "color_name_vi": vi_name,
        "color_hex": std_hex,
        "color_roof": color_roof,
        "image_url": image_url,
        "is_available": available,
    }


def _fmt_vnd(amount: int | float) -> str:
    return f"{int(amount):,}".replace(",", ".")


def _car_fee(fees: list[dict[str, Any]], zone: str | None) -> int:
    """Phí biển số ô tô theo snapshot. zone=None nghĩa là khu vực khác KV1. Thiếu dữ liệu thì lỗi rõ ràng."""
    for fee in fees:
        fee_zone = fee.get("zone")
        if fee.get("carLicenseFee") is None:
            continue
        if (zone is not None and fee_zone == zone) or (zone is None and fee_zone != "KV1"):
            return int(fee["carLicenseFee"])
    raise ValueError(f"Snapshot thiếu carLicenseFee cho khu vực {zone or 'khác KV1'}; không dùng số mặc định cũ")


def _price_of(color_data: dict[str, Any]) -> int | None:
    """Giá tổng của màu từ snapshot; None nếu thiếu (khác với miễn phí)."""
    price = color_data.get("price")
    price = price.get("value") if isinstance(price, dict) else price
    try:
        return int(float(price)) if price not in (None, "") else None
    except (TypeError, ValueError):
        return None


_TIER_BY_ID = {
    "member_tier_platinum": "platinum", "member_tier_gold": "gold",
    "member_tier_diamond": "diamond", "member_tier_member": "member",
}
_PROMO_AUDIENCE = {"o2o": "all", "vinclubTier": "vinclub_tier", "caqd": "public_security_military", "green": "green_switch"}


def _num(value: Any) -> str:
    try:
        return f"{float(value):g}"
    except (TypeError, ValueError):
        return ""


def _build_promotions(data: dict[str, Any], snapshot_dt: str) -> list[dict[str, Any]]:
    """Một dòng = một chương trình ưu đãi từ mục `promotion` của snapshot.

    Hết hạn / ngừng áp dụng: xoá dòng hoặc đặt is_active=false, valid_to trong quá khứ.
    stack_policy luôn là `unknown` vì snapshot không nói chương trình nào cộng dồn được.
    """
    rows: list[dict[str, Any]] = []
    for record in sorted(data.get("promotion", {}).get("records", []), key=lambda r: str(r.get("ID"))):
        promo_type = record.get("type") or ""
        promo_id = record.get("ID") or ""
        tier = _TIER_BY_ID.get(promo_id, "") if promo_type == "vinclubTier" else ""
        if promo_type == "vinclubTier" and not tier:
            continue  # "Không áp dụng" (hạng 0): không có quyền lợi để lưu
        description = record.get("description") or ""
        loyalty = re.search(r"tích điểm[^\d]{0,30}?(\d+(?:[.,]\d+)?)\s*%", description, re.I)
        campaign = record.get("campaign")
        if isinstance(campaign, str) and campaign.strip():
            try:
                campaign = json.loads(campaign)
            except ValueError:
                campaign = {}
        campaign = campaign if isinstance(campaign, dict) else {}
        voucher_values = "|".join(
            f"{v['name']}={int(v['value'])}" for v in campaign.get("vehicles", [])
            if v.get("name") and v.get("value") is not None
        )
        valid_to = ""
        end_match = re.search(r"đến hết\s+(\d{1,2})/(\d{1,2})/(\d{4})", description)
        if end_match:
            day, month, year = (int(g) for g in end_match.groups())
            valid_to = f"{year:04d}-{month:02d}-{day:02d}"
        rows.append({
            "promo_id": promo_id,
            "promo_name": record.get("name") or "",
            "promo_type": promo_type,
            "benefit_type": "voucher" if voucher_values else "cash_discount",
            "discount_percent": _num(record.get("discountPercent")) if record.get("discountPercent") is not None else "",
            "loyalty_percent": _num(loyalty.group(1).replace(",", ".")) if loyalty else "",
            "discount_amount_vnd": "",
            "voucher_values": voucher_values,
            "applies_to": "",
            "stack_policy": "unknown",
            "audience": _PROMO_AUDIENCE.get(promo_type, promo_type),
            "tier": tier,
            "channel": "O2O" if promo_type == "o2o" else "",
            "valid_from": (campaign.get("onlineFrom") or "")[:10],
            "valid_to": valid_to,
            "is_active": str(bool(record.get("active"))).lower(),
            "description": description,
            "snapshot_datetime": snapshot_dt,
        })
    return rows


class RelationalExtractor(BaseExtractor):
    """Parses raw JSON snapshot of vehicle prices, editions, and rolling costs."""

    def __init__(self, bronze_dir: Path):
        self.bronze_dir = Path(bronze_dir)
        self.snapshot_path = (
            self.bronze_dir / "vinfast" / "relational" / "vinfast_rolling_raw_snapshot.json"
        )
        self._cached_vehicles: list[SilverVehicle] = []

    def get_structured_vehicles(self) -> list[SilverVehicle]:
        """Returns structured vehicle records."""
        if not self._cached_vehicles:
            list(self.extract_all())
        return self._cached_vehicles

    def extract_all(self) -> Generator[BronzeDocument, None, None]:
        """Extracts structured vehicles and yields a unified Silver/Bronze document."""
        if not self.snapshot_path.exists():
            logger.warning("Relational snapshot not found at %s", self.snapshot_path)
            return

        try:
            with open(self.snapshot_path, encoding="utf-8") as f:
                data = json.load(f)

            vehicles_data = data.get("vehicles", {})
            objects_data = data.get("objects", {})
            provinces = objects_data.get("provinces", [])
            fees = objects_data.get("fees", [])

            self._cached_vehicles = []
            markdown_sections = ["# Bảng giá xe và chi phí lăn bánh VinFast toàn quốc\n"]

            # 1. Process Cars
            cars = vehicles_data.get("cars", {})
            car_models = cars.get("models", [])
            for m in car_models:
                v = self._process_vehicle_model(
                    model_meta=m,
                    vehicles_container=cars,
                    vehicle_type="car",
                    fees=fees,
                )
                if v:
                    self._cached_vehicles.append(v)
                    markdown_sections.append(v.searchable_markdown)

            full_markdown = "\n\n".join(markdown_sections)

            yield BronzeDocument(
                raw_id="vinfast_vehicles_catalog",
                source_type="relational_snapshot",
                source_file=str(self.snapshot_path),
                title="Bảng giá xe và chi phí lăn bánh VinFast toàn quốc (Dữ liệu cấu trúc)",
                url="https://vinfastauto.com/vn_vi/du-toan-chi-phi-lan-banh",
                category="gia_xe_va_chi_phi_lan_banh",
                domain="vinfastauto.com",
                raw_content=full_markdown,
                raw_metadata={
                    "total_vehicles": len(self._cached_vehicles),
                    "total_provinces": len(provinces),
                },
            )

        except Exception as e:
            logger.error("Failed to parse relational snapshot: %s", e)

    def _process_vehicle_model(
        self,
        model_meta: dict[str, Any],
        vehicles_container: dict[str, Any],
        vehicle_type: str,
        fees: list[dict[str, Any]],
    ) -> SilverVehicle:
        model_id = model_meta.get("id", "")
        model_name = model_meta.get("name", "")
        detail = vehicles_container.get(model_id, {})

        editions = detail.get("listEdition", [])
        if not editions and "null" in detail:
            editions = ["null"]

        trims: list[dict[str, Any]] = []
        model_colors_map: dict[str, dict[str, Any]] = {}
        model_interiors_map: dict[str, dict[str, Any]] = {}

        for ed_code in editions:
            ed_data = detail.get(ed_code, {})
            label = ed_data.get("label") or ed_code
            if label == "null":
                label = "Tiêu chuẩn"

            price_str = ed_data.get("price", "0")
            price_val = ed_data.get("priceValue", 0)
            price_battery = ed_data.get("priceWithBattery", price_val)

            # Extract color options for this trim
            color_codes = ed_data.get("listColor", [])
            trim_colors: list[dict[str, Any]] = []
            for c_code in color_codes:
                c_data = ed_data.get(c_code)
                if isinstance(c_data, dict):
                    color_item = normalize_color_attributes(c_code, c_data)
                    color_item["trim_code"] = ed_code
                    color_item["trim_name"] = label
                    trim_colors.append(color_item)

                    if c_code not in model_colors_map:
                        model_colors_map[c_code] = dict(color_item)
                        model_colors_map[c_code]["supported_trims"] = [label]
                    else:
                        if label not in model_colors_map[c_code]["supported_trims"]:
                            model_colors_map[c_code]["supported_trims"].append(label)

            # Extract interior options for this trim
            interior_codes = ed_data.get("listInterior", [])
            for i_code in interior_codes:
                if not i_code:
                    continue
                i_label = ""
                i_img = ""
                for c_code in color_codes:
                    c_data = ed_data.get(c_code, {})
                    if isinstance(c_data, dict) and i_code in c_data and isinstance(c_data[i_code], dict):
                        i_label = c_data[i_code].get("label", "")
                        i_img = c_data[i_code].get("image", "")
                        if i_label:
                            break

                if i_code not in model_interiors_map:
                    model_interiors_map[i_code] = {
                        "interior_code": i_code,
                        "interior_name": i_label or i_code,
                        "image_url": i_img,
                        "supported_trims": [label],
                    }
                else:
                    if label not in model_interiors_map[i_code]["supported_trims"]:
                        model_interiors_map[i_code]["supported_trims"].append(label)

            trims.append({
                "trim_code": ed_code,
                "label": label,
                "price_vnd": price_str,
                "price_value": price_val,
                "price_with_battery": price_battery,
                "colors": trim_colors,
            })

        # Calculate estimated rolling cost ranges based on license fees
        rolling_costs = {}
        for fee_info in fees:
            zone = fee_info.get("zone", "KV1")
            license_fee = (
                fee_info.get("carLicenseFee")
                if vehicle_type == "car"
                else fee_info.get("bikeLicenseFeeMedium")
            )
            if license_fee is None:
                logger.warning("Snapshot thiếu phí biển số cho khu vực %s (%s); bỏ qua", zone, vehicle_type)
                continue
            rolling_costs[zone] = {
                "license_plate_fee": license_fee,
                "description": "Khu vực 1 (Hà Nội, TP.HCM)" if zone == "KV1" else "Các tỉnh thành khác",
            }

        # Synthesize clean markdown for RAG and search
        type_str = "Ô tô điện" if vehicle_type == "car" else "Xe máy điện"
        md_lines = [
            f"## {type_str} VinFast {model_name}",
            f"- **Loại phương tiện**: {type_str}",
            f"- **Mã định danh**: `{model_id}`",
            "",
            "### Các phiên bản và giá niêm yết:",
        ]

        if trims:
            md_lines.append("| Phiên bản | Giá thuê pin (VNĐ) | Giá kèm pin (VNĐ) |")
            md_lines.append("|---|---|---|")
            for t in trims:
                p_base = t['price_vnd'] if t['price_vnd'] else f"{t['price_value']:,} đ"
                p_bat = f"{t['price_with_battery']:,} đ" if t['price_with_battery'] else "Theo chính sách"
                md_lines.append(f"| {t['label']} | {p_base} | {p_bat} |")
        else:
            md_lines.append("- Liên hệ đại lý hoặc xem thông báo giá mới nhất.")

        # Add Color Palette section
        all_colors = list(model_colors_map.values())
        if all_colors:
            md_lines.append("")
            md_lines.append("### Bảng màu sắc ngoại thất chính hãng:")
            md_lines.append("| Mã màu | Tên màu ngoại thất | Tên thương mại tiếng Anh | Mã Hex | Phiên bản hỗ trợ |")
            md_lines.append("|---|---|---|---|---|")
            for c in all_colors:
                trims_str = ", ".join(c.get("supported_trims", [])) or "Tất cả"
                md_lines.append(
                    f"| `{c['color_code']}` | {c['color_name_vi']} | {c['color_name']} | `{c['color_hex']}` | {trims_str} |"
                )

        # Add Interior Colors section
        all_interiors = list(model_interiors_map.values())
        if all_interiors:
            md_lines.append("")
            md_lines.append("### Tùy chọn màu nội thất:")
            for inter in all_interiors:
                trims_str = ", ".join(inter.get("supported_trims", [])) or "Tất cả"
                md_lines.append(f"- **{inter['interior_name']}** (Mã: `{inter['interior_code']}`) - Áp dụng cho: {trims_str}")

        md_lines.append("")
        md_lines.append("### Lệ phí đăng ký và biển số tham khảo:")
        for zone_label, zone_fee in (
            ("Khu vực 1 (Hà Nội, TP.HCM)", next((f for f in fees if f.get("zone") == "KV1"), None)),
            ("Khu vực 2, 3", next((f for f in fees if f.get("zone") not in (None, "KV1")), None)),
        ):
            if not zone_fee:
                continue
            parts = []
            if zone_fee.get("carLicenseFee") is not None:
                parts.append(f"{_fmt_vnd(zone_fee['carLicenseFee'])} VNĐ (ô tô)")
            low, high = zone_fee.get("bikeLicenseFeeLow"), zone_fee.get("bikeLicenseFeeHigh")
            if low is not None and high is not None:
                parts.append(f"{_fmt_vnd(low)} - {_fmt_vnd(high)} VNĐ (xe máy)")
            if parts:
                md_lines.append(f"- {zone_label}: " + " / ".join(parts))
        md_lines.append("- Ô tô điện chạy pin được miễn 100% lệ phí trước bạ theo quy định của Chính phủ.")

        searchable_md = "\n".join(md_lines)

        return SilverVehicle(
            vehicle_id=model_id,
            model_name=model_name,
            vehicle_type=vehicle_type,
            trims=trims,
            battery_options=[],
            specifications={},
            promotions=[],
            rolling_costs=rolling_costs,
            searchable_markdown=searchable_md,
            colors=all_colors,
            interior_colors=all_interiors,
        )

    def get_relational_tables(self, cars_only: bool = False) -> dict[str, list[dict[str, Any]]]:
        """Extracts normalized relational tables for CSV export into rdb_schema."""
        if not self.snapshot_path.exists():
            return {}

        with open(self.snapshot_path, encoding="utf-8") as f:
            data = json.load(f)

        import os
        from datetime import datetime
        mtime = datetime.fromtimestamp(os.path.getmtime(self.snapshot_path), tz=UTC)
        snapshot_dt = mtime.strftime("%Y-%m-%d %H:%M:%S UTC")

        # 1. Cars Catalog
        cars_catalog: list[dict[str, Any]] = []
        model_name_map: dict[str, str] = {}
        vehicles_data = data.get("vehicles", {})

        car_models = vehicles_data.get("cars", {}).get("models", [])
        for m in car_models:
            c_id = m.get("id", "")
            c_name = m.get("name", "")
            model_name_map[c_id] = c_name
            cars_catalog.append({
                "car_id": c_id,
                "car_name": c_name,
                "default_product_id": m.get("defaultProductID", ""),
                "vehicle_type": "Electric Car",
                "manufacturer": "VinFast",
                "snapshot_datetime": snapshot_dt,
            })

        if not cars_only:
            bike_models = vehicles_data.get("bikes", {}).get("models", [])
            for m in bike_models:
                b_id = m.get("id", "")
                b_name = m.get("name", "")
                model_name_map[b_id] = b_name
                cars_catalog.append({
                    "car_id": b_id,
                    "car_name": b_name,
                    "default_product_id": m.get("defaultProductID", ""),
                    "vehicle_type": "Electric Bike",
                    "manufacturer": "VinFast",
                    "snapshot_datetime": snapshot_dt,
                })

        # 2. Trims Pricing
        trims_pricing: list[dict[str, Any]] = []
        costs = data.get("objects", {}).get("costs", [])
        for c in costs:
            model_id = c.get("model", "")
            if cars_only and "Car" not in model_id:
                continue

            car_name = model_name_map.get(model_id, model_id.replace("Products-Car-", ""))
            trim_name = c.get("ID", "")
            price = c.get("price") or c.get("basePrice") or 0
            try:
                price_val = int(float(price))
            except (ValueError, TypeError):
                price_val = 0

            is_battery_sales = c.get("isBatterySales", False)
            battery_option = "Kèm Pin (Mua Pin)" if is_battery_sales else "Thuê Pin"
            price_last_mod = c.get("lastModified") or snapshot_dt

            trims_pricing.append({
                "trim_id": f"{model_id}_{c.get('UUID', trim_name)}",
                "car_id": model_id,
                "car_name": car_name,
                "trim_name": trim_name,
                "battery_option": battery_option,
                "price_vat_vnd": price_val,
                "deposit_amount_vnd": 50000000 if price_val > 1000000000 else 15000000,
                "product_code": c.get("edition", ""),
                "price_last_updated": price_last_mod,
                "snapshot_datetime": snapshot_dt,
            })

        # 3. Provinces and zone-based fees
        provinces: list[dict[str, Any]] = []
        raw_provinces = data.get("objects", {}).get("provinces", [])
        fees_by_zone = {
            fee.get("zone", ""): fee
            for fee in data.get("objects", {}).get("fees", [])
        }
        for p in raw_provinces:
            fee = fees_by_zone.get(p.get("zone", ""), {})
            provinces.append({
                "province_id": p.get("id") or p.get("ID", ""),
                "province_name": p.get("name", ""),
                "region_code": p.get("region", p.get("zone", "2")),
                "zone": p.get("zone", ""),
                "car_license_plate_fee_vnd": fee.get("carLicenseFee", 0),
                "car_registration_fee_pct": p.get("carRegistrationFee", 0),
                "bike_license_fee_low_vnd": fee.get("bikeLicenseFeeLow", 0),
                "bike_license_fee_medium_vnd": fee.get("bikeLicenseFeeMedium", 0),
                "bike_license_fee_high_vnd": fee.get("bikeLicenseFeeHigh", 0),
                "bike_registration_fee_pct": p.get("bikeRegistrationFee", 0),
                "snapshot_datetime": snapshot_dt,
            })

        # 4. Fee Rules (phí biển số lấy từ snapshot, không hard-code)
        raw_fees = data.get("objects", {}).get("fees", [])
        plate_hn_hcm = _car_fee(raw_fees, "KV1")
        plate_other = _car_fee(raw_fees, None)
        fee_rules: list[dict[str, Any]] = [
            {
                "fee_code": "REGISTRATION_FEE",
                "fee_name": "Lệ phí trước bạ ô tô điện",
                "rate_percent": "0.0",
                "fixed_amount_vnd": 0,
                "description": "Nghị định 10/2022/NĐ-CP & 50/2025/NĐ-CP: Ô tô điện chạy pin miễn 100% lệ phí trước bạ",
                "snapshot_datetime": snapshot_dt,
            },
            {
                "fee_code": "PLATE_FEE_HN_HCM",
                "fee_name": "Phí cấp biển số Khu vực I (Hà Nội, TP.HCM)",
                "rate_percent": "0.0",
                "fixed_amount_vnd": plate_hn_hcm,
                "description": f"Theo snapshot VinFast: Hà Nội và TP.HCM áp dụng {_fmt_vnd(plate_hn_hcm)} VNĐ (đối chiếu Thông tư 155/2025/TT-BTC, hiệu lực từ 01/01/2026)",
                "snapshot_datetime": snapshot_dt,
            },
            {
                "fee_code": "PLATE_FEE_OTHER",
                "fee_name": "Phí cấp biển số Khu vực II & III (Tỉnh/Thành khác)",
                "rate_percent": "0.0",
                "fixed_amount_vnd": plate_other,
                "description": f"Theo snapshot VinFast: các tỉnh thành còn lại {_fmt_vnd(plate_other)} VNĐ (cần đối chiếu Điều 5 Thông tư 155/2025/TT-BTC)",
                "snapshot_datetime": snapshot_dt,
            },
            {
                "fee_code": "INSPECTION_FEE",
                "fee_name": "Phí kiểm định đăng kiểm",
                "rate_percent": "0.0",
                "fixed_amount_vnd": 340000,
                "description": "Thông tư 55/2022/TT-BTC: Xe con dưới 10 chỗ",
                "snapshot_datetime": snapshot_dt,
            },
            {
                "fee_code": "ROAD_MAINTENANCE_FEE",
                "fee_name": "Phí bảo trì đường bộ (1 năm)",
                "rate_percent": "0.0",
                "fixed_amount_vnd": 1560000,
                "description": "Nghị định 90/2023/NĐ-CP: Xe cá nhân 130.000 VNĐ/tháng",
                "snapshot_datetime": snapshot_dt,
            },
            {
                "fee_code": "MANDATORY_INSURANCE",
                "fee_name": "Bảo hiểm TNDS bắt buộc (1 năm)",
                "rate_percent": "0.0",
                "fixed_amount_vnd": 480700,
                "description": "Nghị định 67/2023/NĐ-CP: Xe dưới 6 chỗ không kinh doanh vận tải",
                "snapshot_datetime": snapshot_dt,
            },
        ]

        fixed_fee = {rule["fee_code"]: rule["fixed_amount_vnd"] for rule in fee_rules}

        # 5. Rolling Cost Matrix for every province in the snapshot
        rolling_matrix: list[dict[str, Any]] = []
        for t in trims_pricing:
            price = t["price_vat_vnd"]
            if price <= 0:
                continue

            for prov in provinces:
                plate_fee = prov["car_license_plate_fee_vnd"]
                reg_fee = 0
                insp_fee = fixed_fee["INSPECTION_FEE"]
                road_fee = fixed_fee["ROAD_MAINTENANCE_FEE"]
                ins_fee = fixed_fee["MANDATORY_INSURANCE"]
                total_rolling = price + plate_fee + reg_fee + insp_fee + road_fee + ins_fee

                rolling_matrix.append({
                    "car_id": t["car_id"],
                    "car_name": t["car_name"],
                    "trim_name": t["trim_name"],
                    "battery_option": t["battery_option"],
                    "province_name": prov["province_name"],
                    "list_price_vnd": price,
                    "registration_fee_vnd": reg_fee,
                    "license_plate_fee_vnd": plate_fee,
                    "inspection_fee_vnd": insp_fee,
                    "road_fee_vnd": road_fee,
                    "mandatory_insurance_vnd": ins_fee,
                    "total_rolling_cost_vnd": total_rolling,
                    "snapshot_datetime": snapshot_dt,
                })

        # 6. Vehicle Colors Catalog
        vehicle_colors: list[dict[str, Any]] = []
        target_groups = [("cars", "Electric Car")]
        if not cars_only:
            target_groups.append(("bikes", "Electric Bike"))

        for group_key, v_type in target_groups:
            group_data = vehicles_data.get(group_key, {})
            for m in group_data.get("models", []):
                c_id = m.get("id", "")
                c_name = m.get("name", "")
                detail = group_data.get(c_id, {})
                editions = detail.get("listEdition", [])
                if not editions and "null" in detail:
                    editions = ["null"]

                for ed_code in editions:
                    ed_data = detail.get(ed_code, {})
                    trim_label = ed_data.get("label") or ed_code
                    if trim_label == "null":
                        trim_label = "Tiêu chuẩn"

                    color_codes = ed_data.get("listColor", [])
                    # Giá nền = giá màu rẻ nhất của trim. `priceValue` của snapshot đôi khi là giá màu cao cấp
                    # (VF 3 Plus 304tr, VF 5 Plus 504tr, Minio Green 196tr) nên không dùng làm giá nền.
                    known_prices = [
                        price for code in color_codes
                        if isinstance(ed_data.get(code), dict) and (price := _price_of(ed_data[code])) is not None
                    ]
                    try:
                        base_price = min(known_prices) if known_prices else int(float(ed_data.get("priceValue") or 0))
                    except (TypeError, ValueError):
                        base_price = 0
                    for c_code in color_codes:
                        c_data = ed_data.get(c_code)
                        if isinstance(c_data, dict):
                            norm = normalize_color_attributes(c_code, c_data)
                            total_color_price = _price_of(c_data)
                            # Không clamp và không suy "miễn phí" khi thiếu giá: giá âm/thiếu để trống.
                            extra_price = None if total_color_price is None else total_color_price - base_price
                            known_extra = extra_price is not None and extra_price >= 0
                            vehicle_colors.append({
                                "car_id": c_id,
                                "car_name": c_name,
                                "vehicle_type": v_type,
                                "trim_code": ed_code,
                                "trim_name": trim_label,
                                "color_code": norm["color_code"],
                                "color_name": norm["color_name"],
                                "color_name_vi": norm["color_name_vi"],
                                "color_hex": norm["color_hex"],
                                "color_type": ("Màu nâng cao" if extra_price else "Màu cơ bản") if known_extra else "",
                                "color_extra_price_vnd": extra_price if known_extra else "",
                                "total_car_price_vnd": total_color_price if total_color_price is not None else "",
                                "color_roof": norm["color_roof"],
                                "image_url": norm["image_url"],
                                "is_available": norm["is_available"] if "available" in c_data else "",  # rỗng = không rõ
                                "snapshot_datetime": snapshot_dt,
                            })

        return {
            "cars_catalog": cars_catalog,
            "trims_pricing": trims_pricing,
            "vehicle_colors": vehicle_colors,
            "provinces": provinces,
            "fee_rules": fee_rules,
            "rolling_cost_matrix": rolling_matrix,
            "promotions": _build_promotions(data, snapshot_dt),
        }
