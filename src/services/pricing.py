"""Authoritative pricing shared by API and operational AI catalog."""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select

from src.orm_models import Accessory, BatteryPrice, Dealer, Promotion, RollingCost, VehiclePrice


def calculate_price(req, tables, now=None):
    now = now or datetime.now(UTC).replace(tzinfo=None)
    vehicles = [
        v
        for v in tables["vehicle_prices"]
        if v["model"] == req.model
        and v["version"] == req.version
        and v["color"] == req.color
        and v["effective_from"] <= now
        and (v["effective_to"] is None or v["effective_to"] > now)
    ]
    if len(vehicles) != 1:
        raise HTTPException(409 if vehicles else 404, "Không có một giá xe hiện hành duy nhất cho cấu hình này")
    vehicle = vehicles[0]
    selected_dealer = None
    if getattr(req, "dealer_id", None):
        selected_dealer = next(
            (d for d in tables.get("dealers", []) if str(d["id"]) == str(req.dealer_id) and d["is_active"]), None
        )
        if not selected_dealer:
            raise HTTPException(422, "Đại lý chưa sẵn sàng nhận yêu cầu")
    battery = next((b for b in tables["battery_prices"] if b["model"] == req.model), None)
    if battery is None:
        raise HTTPException(503, "Chưa có dữ liệu giá pin cho dòng xe này")
    fees = next((r for r in tables["rolling_costs"] if r["province"] == req.province), None)
    if fees is None:
        raise HTTPException(422, "Chưa có dữ liệu phí cho tỉnh/thành đã chọn")
    accessories = []
    for code in dict.fromkeys(req.accessories):
        accessory = next((a for a in tables["accessories"] if a["code"] == code and a["is_active"]), None)
        if accessory is None or (accessory["compatible_models"] and req.model not in accessory["compatible_models"]):
            raise HTTPException(422, f"Phụ kiện không khả dụng cho cấu hình: {code}")
        accessories.append({"code": code, "name": accessory["name"], "price": accessory["price"]})
    base = vehicle["price"]
    battery_cost = battery["buy_price"] if req.battery == "buy" else 0
    rolling = {
        "registration_fee": int(base * fees["registration_rate"]),
        "road_fee": fees["road_fee"],
        "inspection_fee": fees["inspection_fee"],
        "insurance": int(base * fees["insurance_rate"]),
        "plate_fee": fees["plate_fee"],
    }
    promos = []
    for p in tables["promotions"]:
        # Dealer offers require an explicit selected dealer; customer conditions
        # require a separate eligibility flow. No offers are implicitly stacked.
        if not p["is_active"] or not (p["start_date"] <= now <= p["end_date"]):
            continue
        if p["conditions"] or (p["dealer_id"] is not None and str(p["dealer_id"]) != str(req.dealer_id)):
            continue
        if p["model"] not in ("ALL", req.model) or (p["province"] and p["province"] != req.province):
            continue
        value = p["discount_value"] if str(p["discount_type"]) == "fixed" else int(base * p["discount_value"] / 100)
        promos.append(
            {
                "id": str(p["id"]),
                "name": p["name"],
                "value": value,
                "source": "dealer" if p["dealer_id"] else "vinfast_national",
            }
        )
    # No schema field currently authorizes stacking: apply the largest eligible offer.
    promos = sorted(promos, key=lambda p: (-p["value"], p["id"]))[:1]
    subtotal = base + battery_cost + sum(a["price"] for a in accessories)
    discount = sum(p["value"] for p in promos)
    return {
        "base_price": base,
        "battery_cost": battery_cost,
        "battery_rent": battery["rent_price"],
        "accessories": accessories,
        "rolling_costs": rolling,
        "promotions": promos,
        "total_discount": discount,
        "final_price": max(0, subtotal + sum(rolling.values()) - discount),
        "province": req.province,
        "price_version": vehicle["price_version"],
        "calculated_at": now.isoformat() + "Z",
        "data_source": "postgresql/public",
        "dealer": {
            "id": str(selected_dealer["id"]),
            "name": selected_dealer["name"],
            "phone": selected_dealer.get("phone"),
            "address": selected_dealer.get("address"),
        }
        if selected_dealer
        else None,
        "disclaimer": "Giá tham khảo từ dữ liệu hiện hành. Ưu đãi có điều kiện/đại lý cần xác nhận riêng; không cộng dồn ưu đãi.",
    }


async def load_pricing_tables(db):
    tables = {}
    for model in (VehiclePrice, BatteryPrice, Accessory, RollingCost, Promotion, Dealer):
        result = await db.execute(select(model))
        tables[model.__tablename__] = [
            {c.name: getattr(row, c.name) for c in model.__table__.columns} for row in result.scalars().all()
        ]
    return tables


async def price_configuration(req, db):
    return calculate_price(req, await load_pricing_tables(db))
