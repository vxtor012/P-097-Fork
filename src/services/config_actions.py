"""Explicit configuration commands grounded in the current business catalog."""

import re
import unicodedata

from src.models.schemas import ConfigRequest
from src.services.pricing import calculate_price


def normalized(text):
    text = unicodedata.normalize("NFKD", str(text).lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in text if not unicodedata.combining(c)))


def configuration_command(message, context, tables, now):
    if (
        not context
        or not all(context.get(k) for k in ("model", "version", "color", "province", "battery"))
        or not re.search(r"\b(đổi|chuyển|chọn|thêm|bỏ)\b|đăng ký", message, re.I)
        or re.search(r"\b(không|đừng|chưa)\s+(đổi|chuyển|chọn|thêm|bỏ)\b", message, re.I)
    ):
        return None
    query = normalized(message)
    rows = [
        v
        for v in tables["vehicle_prices"]
        if v["effective_from"] <= now and (v["effective_to"] is None or v["effective_to"] > now)
    ]
    requested_models = re.findall(r"VF\s*(\d+)", message, re.I)
    requested_ids = {"vf" + number for number in requested_models}
    models = {v["model"] for v in rows if normalized(v["model"]) in requested_ids}
    if requested_ids - {normalized(v["model"]) for v in rows}:
        return {"response": "Dòng xe bạn yêu cầu chưa có trong danh mục hiện hành."}
    if len(models) > 1:
        return {"response": "Bạn muốn chuyển sang dòng xe nào? Hãy chọn một dòng xe cụ thể."}
    model = next(iter(models), None) or next(
        (v["model"] for v in rows if normalized(v["model"]) == normalized(context.get("model"))), None
    )
    options = sorted([v for v in rows if v["model"] == model], key=lambda v: (v["price"], v["version"], v["color"]))
    if not options:
        return None
    version_matches = {v["version"] for v in options if normalized(v["version"]) in query}
    if len(version_matches) > 1:
        return {"response": "Bạn muốn chọn phiên bản nào? Hãy nêu rõ một phiên bản."}
    version = next(iter(version_matches), context.get("version"))
    if models and normalized(model) != normalized(context.get("model")) and not version_matches:
        available = sorted({v["version"] for v in options})
        if len(available) > 1:
            return {"response": f"Bạn muốn chọn phiên bản nào của {model}: " + ", ".join(available) + "?"}
    versions = [v for v in options if v["version"] == version]
    if not versions:
        version = options[0]["version"]
        versions = [v for v in options if v["version"] == version]
    color = context.get("color")
    colors = {v["color"] for v in versions}
    matches = [c for c in colors if normalized(c) in query]
    exact = [c for c in matches if not any(normalized(c) in normalized(other) for other in matches if other != c)]
    if len(exact) > 1:
        return {"response": "Bạn muốn chọn màu nào? Hãy nêu một màu cụ thể."}
    if matches:
        color = max(matches, key=lambda c: len(normalized(c)))
    elif "mau" in query:
        body = re.search(r"mau(trang|den|do|xanh|vang|hong|xam|bac)", query)
        candidates = [c for c in colors if body and normalized(c).startswith(body.group(1))]
        if len(candidates) != 1 or "noc" in query:
            return {"response": "Hãy nêu đúng màu đang có cho phiên bản này: " + ", ".join(sorted(colors)) + "."}
        color = candidates[0]
    if color not in colors:
        color = versions[0]["color"]
    provinces = [p["province"] for p in tables["rolling_costs"] if normalized(p["province"]) in query]
    if len(provinces) > 1:
        return {"response": "Bạn muốn đăng ký tại tỉnh/thành nào? Hãy nêu một địa phương."}
    province = provinces[0] if provinces else context.get("province")
    if ("dangky" in query or "saigon" in query or "hcm" in query) and not provinces:
        if "saigon" in query or "hcm" in query:
            province = "TP. Hồ Chí Minh"
        else:
            return {"response": "Tỉnh đăng ký chưa khớp danh mục hiện hành. Hãy chọn địa phương trong cấu hình."}
    battery = context.get("battery")
    if "muapin" in query and "thuepin" in query:
        return {"response": "Bạn muốn mua pin hay thuê pin? Hãy chọn một phương án."}
    if "muapin" in query:
        battery = "buy"
    elif "thuepin" in query:
        battery = "rent"
    accessories = list(context.get("accessories") or [])
    for accessory in tables["accessories"]:
        if normalized(accessory["name"]) in query:
            if re.search(r"\bbỏ\b", message, re.I):
                accessories = [a for a in accessories if a != accessory["code"]]
            elif re.search(r"\bthêm\b", message, re.I) and accessory["code"] not in accessories:
                accessories.append(accessory["code"])
    request = ConfigRequest(
        model=model,
        version=version,
        color=color,
        province=province,
        battery=battery,
        accessories=accessories,
        dealer_id=context.get("dealer_id"),
    )
    if all(
        normalized(getattr(request, field)) == normalized(context.get(field))
        for field in ("model", "version", "color", "province", "battery")
    ) and request.accessories == context.get("accessories", []):
        return None
    price = calculate_price(request, tables, now)
    amount = f"{price['final_price']:,}".replace(",", ".")
    return {
        "response": f"Cấu hình được xác nhận: {model} {version}, {color}, đăng ký tại {province}, "
        f"{'mua pin' if battery == 'buy' else 'thuê pin'}. Tổng dự tính: {amount} đồng. "
        "Giá chính thức cần đại lý xác nhận.",
        "configuration_update": request.model_dump(mode="json"),
    }
