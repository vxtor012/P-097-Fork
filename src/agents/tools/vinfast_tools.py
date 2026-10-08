"""Deterministic VinFast catalog, ownership-cost, and promotion tools."""

import json
import re
import unicodedata
from datetime import date
from typing import Literal

from langchain_core.tools import tool

from src import ai_data
from src.agents.tools.rag import search_gold_knowledge


def _normalize(text: str | None) -> str:
    text = unicodedata.normalize("NFKD", (text or "").replace("đ", "d").replace("Đ", "D"))
    value = "".join(char for char in text if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9]+", "", value.lower())
    if value.startswith("thanhpho"):
        value = value[len("thanhpho"):]
    elif value.startswith("tp"):
        value = value[2:]
    return {"hcm": "hochiminh", "hn": "hanoi"}.get(value, value)


def _read_csv(name: str) -> list[dict[str, str]]:
    return ai_data.catalog_rows(name)


def _format_vnd(amount: int | float) -> str:
    value = float(amount)
    if abs(value) >= 1_000_000_000:
        number, unit, digits = value / 1_000_000_000, "tỷ", 3
    else:
        number, unit, digits = value / 1_000_000, "triệu", 2
    formatted = f"{number:.{digits}f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{formatted} {unit} đồng"


VinclubTier = Literal["platinum", "gold", "diamond", "member"]
CustomerGroup = Literal["public_security_military", "green_switch"]
VehicleField = Literal["overview", "price", "colors", "performance", "battery_charging", "dimensions", "other_specs"]
SPEC_FIELDS = {"performance", "battery_charging", "dimensions", "other_specs"}
PROVINCE_ALIASES = {
    "saigon": "hochiminh", "sg": "hochiminh", "hue": "thuathienhue",
    "vungtau": "bariavungtau", "baria": "bariavungtau", "brvt": "bariavungtau",
}


def _province_key(name: str | None) -> str:
    key = _normalize(name)
    return PROVINCE_ALIASES.get(key, key)


def _provinces() -> list[dict[str, str]]:
    return _read_csv("provinces.csv")


def _match_province(name: str | None) -> tuple[dict | None, list[str]]:
    """Khớp tỉnh/thành (có alias). Không khớp thì trả danh sách gợi ý gần đúng."""
    key = _province_key(name)
    rows = _provinces()
    exact = next((row for row in rows if _normalize(row["province_name"]) == key), None)
    if exact or not key:
        return exact, []
    candidates = [row["province_name"] for row in rows
                  if key in _normalize(row["province_name"]) or _normalize(row["province_name"]) in key]
    return None, candidates[:5] or [row["province_name"] for row in rows[:5]]


def _canonical_tier(value: str | None) -> str | None:
    normalized = _normalize(value)
    for aliases, canonical in (
        (("platinum", "bachkim"), "platinum"),
        (("diamond", "kimcuong"), "diamond"),
        (("gold", "vang"), "gold"),
        (("member", "thanhvien", "chuacohang"), "member"),
    ):
        if any(alias in normalized for alias in aliases):
            return canonical
    return normalized or None


def _canonical_group(value: str | None) -> str | None:
    normalized = _normalize(value)
    if any(alias in normalized for alias in ("congan", "quandoi", "military", "publicsecurity")):
        return "publicsecuritymilitary"
    if any(alias in normalized for alias in ("xexang", "chuyendoixanh", "greenswitch")):
        return "greenswitch"
    return normalized or None


def _trim_codes(code: str) -> list[str]:
    """GC12V_CR151_T023 -> [GC12V_CR151_T023, GC12V_CR151, GC12V] (thử mã đầy đủ rồi mã gốc)."""
    parts = (code or "").split("_")
    return ["_".join(parts[:i]) for i in range(len(parts), 0, -1)] if code else []


def _colors_for(colors_by_trim: dict, car_id: str, product_code: str) -> tuple[list[dict], bool]:
    for code in _trim_codes(product_code):
        if (car_id, code) in colors_by_trim:
            return colors_by_trim[(car_id, code)], code != product_code
    return [], False


def _int_or_none(value: str | None) -> int | None:
    try:
        return int(float(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _voucher_values(promotion: dict) -> list[dict]:
    """"Fadil=30000000|Lux A2.0=60000000" -> danh sách giá trị voucher theo xe xăng đang sở hữu."""
    values = []
    for part in (promotion.get("voucher_values") or "").split("|"):
        name, _, amount = part.partition("=")
        if name.strip() and amount.strip().isdigit():
            values.append({"owned_vehicle": name.strip(), "value_vnd": int(amount), "value_text": _format_vnd(int(amount))})
    return values


def _load_promotions() -> list[dict] | None:
    """None nghĩa là CHƯA có dữ liệu ưu đãi (khác với 'không có ưu đãi')."""
    rows = _read_csv("promotions.csv")
    needed = {"promo_name", "benefit_type", "valid_from", "valid_to", "audience", "is_active"}
    return rows if not rows or needed <= set(rows[0]) else None


def _load_data() -> tuple[list[dict], list[dict], list[dict] | None]:
    cars = {
        row["car_id"]: row
        for row in _read_csv("cars_catalog.csv")
        if row.get("vehicle_type", "").lower() == "electric car"
    }
    prices = _read_csv("trims_pricing.csv")
    color_rows = _read_csv("vehicle_colors.csv")
    rolling_rows = _read_csv("rolling_cost_matrix.csv")
    colors_by_trim: dict[tuple[str, str], list[dict]] = {}
    unavailable: dict[tuple[str, str], list[dict]] = {}
    for row in color_rows:
        key = (row["car_id"], row["trim_code"])
        entry = {
            "color": row["color_name"],
            "color_name_vi": row["color_name_vi"],
            "color_code": row["color_code"],
            "color_hex": row["color_hex"],
            "color_type": row.get("color_type", ""),
            "extra_price_vnd": _int_or_none(row.get("color_extra_price_vnd")),
            "image_url": row.get("image_url", ""),
        }
        if row.get("is_available", "").strip().lower() == "false":
            unavailable.setdefault(key, []).append(entry)
        else:
            colors_by_trim.setdefault(key, []).append(entry)

    catalog = []
    for row in prices:
        car = cars.get(row["car_id"])
        if car is None:
            continue
        price = int(row["price_vat_vnd"] or 0)
        code = row.get("product_code", "")
        colors, inferred = _colors_for(colors_by_trim, row["car_id"], code)
        off_colors, _ = _colors_for(unavailable, row["car_id"], code)
        # Một nguồn giá duy nhất: giá xe lấy từ trims_pricing, màu chỉ cộng phụ phí.
        colors = [{**c, "total_car_price_vnd": None if c["extra_price_vnd"] is None else price + c["extra_price_vnd"]}
                  for c in colors]
        catalog.append({
            "model_id": row["car_id"],
            "edition_id": row["trim_id"],
            "name": f"VinFast {row['car_name']}",
            "model_name": row["car_name"],
            "edition": row["trim_name"],
            "battery_option": row.get("battery_option", ""),
            "price_vnd": price,
            "segment": None,
            "seats": None,
            "specs": {},
            "colors": colors,
            "colors_inferred_from_base_trim": inferred,
            "unavailable_colors": off_colors,
        })
    return catalog, rolling_rows, _load_promotions()


FILLER_RE = re.compile(r"\b(vinfast|phiên bản|phien ban|bản|ban|version)\b", re.I)


def _resolve(queries: list[str] | None) -> tuple[list[dict], list[str]]:
    catalog, _, _ = _load_data()
    if not queries:
        return catalog, []
    results: list[dict] = []
    unmatched = []
    for query in queries:
        cleaned = FILLER_RE.sub(" ", unicodedata.normalize("NFC", query or ""))
        term = _normalize(cleaned)
        found: list[dict] = []
        if term:
            # Tách tên dòng xe khỏi phần phiên bản: "VF 6 Plus" -> model "vf6" + "plus".
            for vehicle in catalog:
                model = _normalize(vehicle["model_name"])
                if model and model in term:
                    rest = term.replace(model, "", 1)
                    if not rest or rest in _normalize(vehicle["edition"]).replace(model, "", 1):
                        found.append(vehicle)
            if not found:
                found = [v for v in catalog if term in _normalize(v["model_name"] + " " + v["edition"])]
        if not found:
            # "VF 6 Ultra" -> trả các phiên bản thật của VF 6 và báo rõ phiên bản hỏi không có.
            found = [v for v in catalog if term and _normalize(v["model_name"]) in term]
            if found:
                unmatched.append(f"{query} (không có đúng phiên bản này; liệt kê các phiên bản hiện có của dòng xe)")
        if not found:
            unmatched.append(query)
        for vehicle in found:
            if vehicle not in results:
                results.append(vehicle)
    return results, unmatched


@tool
@ai_data.pinned
def search_vehicles(
    vehicle_queries: list[str] | None = None,
    fields: list[VehicleField] | None = None,
    seats: int | None = None,
    budget_million: float | None = None,
    segment: str | None = None,
) -> str:
    """Look up VinFast car trims, official catalog prices and available exterior colors.

    The structured catalog has NO data for seats, segment or technical specs (performance,
    battery_charging, dimensions, other_specs); use search_gold_knowledge for those.

    Args:
        vehicle_queries: Car names or trims to look up, e.g. ["VF 6 Plus"].
        fields: Requested fields: overview, price, colors (performance, battery_charging, dimensions, other_specs are not available here).
        seats: Not supported by the catalog yet; ignored with a note.
        budget_million: Maximum listed price, in million VND.
        segment: Not supported by the catalog yet; ignored with a note.
    """
    catalog, _, _ = _load_data()
    vehicles, unmatched = _resolve(vehicle_queries)
    fields = fields or ["overview", "price"]
    notes = [f"Không tìm thấy xe: {q}" for q in unmatched]
    missing = [name for name, value in (("seats", seats), ("segment", segment)) if value not in (None, "")]
    missing += [name for name in fields if name in SPEC_FIELDS]
    if missing:
        notes.append(f"Catalog có cấu trúc chưa có dữ liệu {sorted(set(missing))}; dùng search_gold_knowledge cho "
                     "thông số/số chỗ/phân khúc và KHÔNG kết luận rằng xe không tồn tại.")
    if budget_million is not None:
        vehicles = [v for v in vehicles if v["price_vnd"] <= budget_million * 1_000_000]

    if not vehicle_queries and not budget_million:
        groups: dict[str, list[dict]] = {}
        for vehicle in catalog:
            groups.setdefault(vehicle["model_name"], []).append(vehicle)
        models = [{
            "model": model,
            "trims": len(rows),
            "price_range": f"{_format_vnd(min(v['price_vnd'] for v in rows))} - {_format_vnd(max(v['price_vnd'] for v in rows))}",
        } for model, rows in groups.items()]
        return json.dumps({"models": models, "notes": notes}, ensure_ascii=False)

    output = []
    for vehicle in vehicles:
        record = {"name": vehicle["name"], "edition": vehicle["edition"]}
        if "overview" in fields:
            record.update(segment=vehicle["segment"], seats=vehicle["seats"])
        if "price" in fields:
            record.update(price_vnd=vehicle["price_vnd"], price_text=_format_vnd(vehicle["price_vnd"]))
        if "colors" in fields:
            record["exterior_colors"] = vehicle["colors"]
            record["colors_inferred_from_base_trim"] = vehicle["colors_inferred_from_base_trim"]
            record["unavailable_color_count"] = len(vehicle["unavailable_colors"])
            if not vehicle["colors"]:
                notes.append(
                    f"{vehicle['name']} {vehicle['edition']}: "
                    + ("dữ liệu ghi các màu của phiên bản này hiện không khả dụng, cần xác nhận với đại lý."
                       if vehicle["unavailable_colors"] else "catalog không có dữ liệu màu, không kết luận xe không có màu."))
        output.append(record)

    return json.dumps({
        "matched_versions": output,
        "notes": list(dict.fromkeys(notes)),
        "catalog_source": ai_data.provenance(),
    }, ensure_ascii=False)


@tool
@ai_data.pinned
def lookup_car_color_options(vehicle_queries: list[str]) -> str:
    """Look up exterior colors and color surcharges for VinFast trims.

    color_options lists colors currently marked available; unavailable_color_options lists colors the
    data marks as unavailable (do not offer them as choices; tell the user to confirm with a dealer).

    Args:
        vehicle_queries: Car models or trims to look up, e.g. ["VF 3", "VF 6 Plus"].
    """
    vehicles, unmatched = _resolve(vehicle_queries)
    available, unavailable = [], []
    for vehicle in vehicles:
        base = {"model": vehicle["model_name"], "edition": vehicle["edition"]}
        for color in vehicle["colors"]:
            option = {**base, **color}
            if option not in available:
                available.append(option)
        for color in vehicle["unavailable_colors"]:
            option = {**base, **color}
            if option not in unavailable:
                unavailable.append(option)
    notes = [f"Không tìm thấy màu xe: {query}" for query in unmatched]
    if unavailable:
        notes.append("Một số màu được dữ liệu ghi là không khả dụng; cần xác nhận với đại lý trước khi tư vấn.")
    return json.dumps({
        "color_options": available,
        "unavailable_color_options": unavailable,
        "notes": notes,
        "catalog_source": ai_data.provenance("vehicle_colors"),
    }, ensure_ascii=False)


@tool
@ai_data.pinned
def lookup_province_fees(province: str, vehicle_queries: list[str] | None = None) -> str:
    """Look up vehicle registration fees by Vietnamese province or city.

    Args:
        province: Province or city, e.g. "Hà Nội" or "TP. Hồ Chí Minh".
        vehicle_queries: Optional car models or trims for an estimated car registration total.
    """
    fee_row, candidates = _match_province(province)
    if fee_row is None:
        return json.dumps({"error": f"Không tìm thấy phí cho tỉnh/thành: {province}",
                           "valid_candidates": candidates}, ensure_ascii=False)

    registration_rate = float(fee_row["car_registration_fee_pct"] or 0)
    fees = {
        "province": fee_row["province_name"],
        "zone": fee_row["zone"],
        "car_license_plate_fee_vnd": int(fee_row["car_license_plate_fee_vnd"] or 0),
        "car_registration_fee_percent": registration_rate * 100,
        "bike_license_fee_low_vnd": int(fee_row["bike_license_fee_low_vnd"] or 0),
        "bike_license_fee_medium_vnd": int(fee_row["bike_license_fee_medium_vnd"] or 0),
        "bike_license_fee_high_vnd": int(fee_row["bike_license_fee_high_vnd"] or 0),
        "bike_registration_fee_percent": float(fee_row["bike_registration_fee_pct"] or 0) * 100,
    }
    estimates = []
    unmatched = []
    if vehicle_queries:
        vehicles, unmatched = _resolve(vehicle_queries)
        for vehicle in vehicles:
            registration = round(vehicle["price_vnd"] * registration_rate)
            plate_fee = fees["car_license_plate_fee_vnd"]
            estimates.append({
                "vehicle": vehicle["name"],
                "edition": vehicle["edition"],
                "listed_price_vnd": vehicle["price_vnd"],
                "car_registration_fee_vnd": registration,
                "car_license_plate_fee_vnd": plate_fee,
                "estimated_province_fees_vnd": registration + plate_fee,
            })

    return json.dumps({
        "fees": fees,
        "car_estimates": estimates,
        "notes": [f"Không tìm thấy xe: {query}" for query in unmatched],
        "catalog_source": ai_data.provenance("provinces"),
    }, ensure_ascii=False)


@tool
@ai_data.pinned
def calculate_vehicle_tco(vehicle_queries: list[str], location: str, years: int | None = None) -> str:
    """Calculate known purchase and ownership costs from the Supabase VinFast fee tables.

    Both location and years must come from the user; ask them if missing instead of assuming.

    Args:
        vehicle_queries: Car names or trims, e.g. ["VF 6 Plus"].
        location: Province or city the user stated, e.g. "Hà Nội".
        years: Ownership period stated by the user, at least one year.
    """
    if years is None:
        return json.dumps({"status": "need_input", "missing": ["years"],
                           "message": "Hỏi người dùng muốn tính chi phí trong bao nhiêu năm; không tự điền."},
                          ensure_ascii=False)
    if years < 1 or years > 50:
        return json.dumps({"error": "years phải nằm trong khoảng 1 đến 50"}, ensure_ascii=False)
    if not (location or "").strip():
        return json.dumps({"status": "need_input", "missing": ["location"],
                           "message": "Hỏi người dùng sẽ đăng ký xe ở tỉnh/thành nào."}, ensure_ascii=False)
    province, candidates = _match_province(location)
    if province is None:
        return json.dumps({"error": f"Không nhận ra tỉnh/thành: {location}", "valid_candidates": candidates},
                          ensure_ascii=False)
    province_key = _normalize(province["province_name"])
    vehicles, unmatched = _resolve(vehicle_queries)
    _, rolling_rows, _ = _load_data()
    results = []
    for vehicle in vehicles:
        row = next((r for r in rolling_rows
                    if r["car_id"] == vehicle["model_id"]
                    and _normalize(r["trim_name"]) == _normalize(vehicle["edition"])
                    and _normalize(r.get("battery_option")) == _normalize(vehicle["battery_option"])
                    and _normalize(r["province_name"]) == province_key), None)
        if not row:
            results.append({
                "vehicle": vehicle["name"], "edition": vehicle["edition"],
                "listed_price_vnd": vehicle["price_vnd"],
                "listed_price_text": _format_vnd(vehicle["price_vnd"]),
                "location": province["province_name"],
                "note": "Bảng chi phí lăn bánh không có dòng cho xe này ở địa phương này; chưa tính tổng lăn bánh.",
            })
            continue
        initial = int(row["total_rolling_cost_vnd"])
        annual = int(row.get("road_fee_vnd") or 0) + int(row.get("mandatory_insurance_vnd") or 0)
        total = initial + annual * (years - 1)
        results.append({
            "vehicle": vehicle["name"], "edition": vehicle["edition"], "years": years,
            "location": province["province_name"], "initial_cost_vnd": initial,
            "initial_cost_text": _format_vnd(initial),
            "estimated_known_cost_vnd": total,
            "estimated_known_cost_text": _format_vnd(total),
            "excludes": ["điện", "bảo dưỡng", "khấu hao", "giá bán lại", "khuyến mãi",
                         "phí kiểm định định kỳ các năm sau"],
        })
    return json.dumps({"tco": results, "notes": [f"Không tìm thấy xe: {q}" for q in unmatched]}, ensure_ascii=False)


@tool
@ai_data.pinned
def get_eligible_promotions(
    vehicle_queries: list[str] | None = None,
    vinclub_tier: VinclubTier | None = None,
    customer_group: CustomerGroup | None = None,
    purchase_channel: str | None = None,
) -> str:
    """Check current VinFast promotions and calculate explicit cash discounts when eligible.

    Args:
        vehicle_queries: Car names or trims, e.g. ["VF 6 Plus"].
        vinclub_tier: Customer tier the user stated: platinum, gold, diamond or member. Leave null if unknown.
        customer_group: Eligibility group the user stated: public_security_military or green_switch. Leave null if unknown.
        purchase_channel: Sales channel the user stated, such as O2O. Leave null if unknown.
    """
    vehicles, unmatched = _resolve(vehicle_queries) if vehicle_queries else ([], [])
    _, _, promotions = _load_data()
    if promotions is None:
        return json.dumps({
            "status": "data_unavailable",
            "message": "Chưa có dữ liệu ưu đãi có cấu trúc. KHÔNG kết luận là hiện không có ưu đãi và không nêu số tiền ưu đãi; "
                       "hướng dẫn người dùng liên hệ đại lý hoặc kênh chính thức của VinFast.",
        }, ensure_ascii=False)
    today = date.today()
    tier = _canonical_tier(vinclub_tier)
    group = _canonical_group(customer_group)
    channel = _normalize(purchase_channel) or None
    applicable = []
    conditional = []
    for promotion in promotions:
        if promotion.get("is_active", "").lower() != "true":
            continue
        start = date.fromisoformat(promotion["valid_from"]) if promotion.get("valid_from") else None
        end = date.fromisoformat(promotion["valid_to"]) if promotion.get("valid_to") else None
        if (start and today < start) or (end and today > end):
            continue
        audience = promotion.get("audience") or "all"
        missing = None
        if audience == "vinclub_tier" and tier is None:
            missing = "vinclub_tier"
        elif audience not in {"all", "vinclub_tier"} and group is None:
            missing = "customer_group"
        elif promotion.get("channel") and channel is None:
            missing = "purchase_channel"
        if missing:
            conditional.append({"name": promotion["promo_name"], "requires": missing})
            continue
        if audience == "vinclub_tier" and _canonical_tier(promotion.get("tier")) != tier:
            continue
        if audience not in {"all", "vinclub_tier"} and _canonical_group(audience) != group:
            continue
        if promotion.get("channel") and _normalize(promotion["channel"]) != channel:
            continue
        applicable.append(promotion)

    if not vehicle_queries:
        return json.dumps({
            "programs": [{
                "name": promotion["promo_name"],
                "benefit_type": promotion.get("benefit_type"),
                "discount_percent": float(promotion.get("discount_percent") or 0),
                "loyalty_percent": float(promotion.get("loyalty_percent") or 0),
                "description": promotion.get("description", ""),
                "valid_to": promotion.get("valid_to") or None,
                **({"voucher_values": _voucher_values(promotion)} if promotion.get("voucher_values") else {}),
            } for promotion in applicable],
            "conditional_promotions": conditional,
            "notes": ["Chưa có xe cụ thể nên chưa tính số tiền ưu đãi."],
        }, ensure_ascii=False)

    results = []
    for vehicle in vehicles:
        model = vehicle["model_name"]
        benefits = []
        used_promotions = []
        for promotion in applicable:
            allowed_models = [part.strip() for part in promotion.get("applies_to", "").split("|") if part.strip()]
            if allowed_models and model not in allowed_models:
                continue
            price = vehicle["price_vnd"]
            discount = round(price * float(promotion.get("discount_percent") or 0) / 100)
            discount += int(float(promotion.get("discount_amount_vnd") or 0))
            benefit = {"name": promotion["promo_name"], "description": promotion.get("description", ""),
                       "valid_to": promotion.get("valid_to") or None}
            if promotion.get("voucher_values"):
                benefit["voucher_values"] = _voucher_values(promotion)
                benefit["note"] = "Voucher theo xe xăng VinFast khách đang sở hữu; không trừ trực tiếp vào giá xe."
            if promotion.get("benefit_type") == "cash_discount" and discount:
                benefit.update(
                    discount_vnd=discount,
                    discount_text=_format_vnd(discount),
                    price_after_discount_vnd=price - discount,
                    price_after_discount_text=_format_vnd(price - discount),
                )
            if float(promotion.get("loyalty_percent") or 0):
                points = round(price * float(promotion["loyalty_percent"]) / 100)
                benefit["loyalty_points"] = {
                    "value_vnd": points,
                    "value_text": _format_vnd(points),
                    "note": "Tích điểm, không trừ vào giá xe.",
                }
            benefits.append(benefit)
            used_promotions.append(promotion)
        cash_benefits = [benefit for benefit in benefits if "discount_vnd" in benefit]
        stackable = all(promotion.get("stack_policy") == "stackable" for promotion in used_promotions)
        results.append({
            "vehicle": vehicle["name"], "edition": vehicle["edition"],
            "listed_price_text": _format_vnd(vehicle["price_vnd"]),
            "programs": benefits,
            "stacking": "stackable" if len(cash_benefits) < 2 or stackable else "unknown",
            "note": "Không cộng dồn các ưu đãi khi dữ liệu chưa xác nhận; cần hỏi đại lý." if len(cash_benefits) > 1 and not stackable else None,
        })
    return json.dumps({
        "vehicles": results,
        "conditional_promotions": conditional,
        "inputs": {"vinclub_tier": tier, "customer_group": group, "purchase_channel": channel},
        "notes": [f"Không tìm thấy xe: {q}" for q in unmatched],
    }, ensure_ascii=False)


VINFAST_TOOLS = [
    search_gold_knowledge,
    search_vehicles,
    lookup_car_color_options,
    lookup_province_fees,
    calculate_vehicle_tco,
    get_eligible_promotions,
]
