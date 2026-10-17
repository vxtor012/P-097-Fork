"""Authoritative pricing shared by API and operational AI catalog."""

from datetime import UTC, datetime
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select

from src.orm_models import Accessory, BatteryPrice, Dealer, Promotion, RollingCost, VehiclePrice, PricingPolicy
from src.services.pricing_policy import (
    PromotionState, current_policy, enforce_battery_policy, promotion_decision, trusted_verifications, verified_value,
)


def pricing_hash(req, tables, resolved):
    # Canonicalize sets of rows, not timestamps of the calculation or only totals.
    # Full rows include metadata, so irrelevant edits can cause a safe but unnecessary 409.
    inputs = {
        "hash_schema": 1,
        "request": {key: str(getattr(req, key, None)) for key in
                    ("model", "version", "color", "province", "battery", "dealer_id")},
        "accessories": sorted(set(req.accessories)),
        "claims": getattr(req, "customer_claims", {}) or {},
        "subject_id": tables.get("subject_id"),
        "tables": {name: sorted(tables.get(name, []), key=lambda r: json.dumps(r, sort_keys=True, default=str))
                   for name in ("vehicle_prices", "battery_prices", "accessories", "rolling_costs",
                                "promotions", "dealers", "pricing_policies", "eligibility_verifications")},
        "resolved": resolved,
    }
    return hashlib.sha256(json.dumps(inputs, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def calculate_price(req, tables, now=None):
    now = now or datetime.now(UTC).replace(tzinfo=None)
    policy = current_policy(tables, now)
    records = trusted_verifications(tables, getattr(req, "dealer_id", None))
    enforce_battery_policy(req, policy, records)
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
    decisions = []
    for p in tables["promotions"]:
        # Dealer offers require an explicit selected dealer; customer conditions
        # require a separate eligibility flow. No offers are implicitly stacked.
        if not p["is_active"] or not (p["start_date"] <= now <= p["end_date"]):
            continue
        if p["dealer_id"] is not None and str(p["dealer_id"]) != str(getattr(req, "dealer_id", None)):
            continue
        if p["model"] not in ("ALL", req.model) or (p["province"] and p["province"] != req.province):
            continue
        value = p["discount_value"] if str(p["discount_type"]) == "fixed" else int(base * p["discount_value"] / 100)
        decision = promotion_decision(p, records, getattr(req, "customer_claims", {}) or {})
        decision["potential_value"] = value
        decisions.append(decision)
        if decision["state"] != PromotionState.verified_applied:
            continue
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
    for decision in decisions:
        decision["applied_to_price"] = any(p["id"] == decision["id"] for p in promos)
        if decision["state"] == PromotionState.verified_applied and not decision["applied_to_price"]:
            decision["reason"] = "not_selected_largest_only"
    subtotal = base + battery_cost + sum(a["price"] for a in accessories)
    discount = sum(p["value"] for p in promos)
    result = {
        "base_price": base,
        "battery_cost": battery_cost,
        "battery_rent": battery["rent_price"] if req.battery == "rent" else 0,
        "accessories": accessories,
        "rolling_costs": rolling,
        "promotions": promos,
        "promotion_decisions": sorted(decisions, key=lambda d: d["id"]),
        "eligibility_snapshot": json.loads(json.dumps(records, default=str)),
        "battery_policy": policy,
        "battery_options": {"buy": True, "rent": bool(policy and (
            policy["rules"].get("new_rental_allowed") is True or verified_value(records, "legacy_battery_rental", "true")))},
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
    result["pricing_hash"] = pricing_hash(req, tables, {
        "vehicle": vehicle, "policy": policy, "decisions": result["promotion_decisions"],
        "promotions": promos, "rolling": rolling, "final_price": result["final_price"],
    })
    # Keep transport values JSON serializable, including versioned policy dates.
    if policy:
        result["battery_policy"] = json.loads(json.dumps(policy, default=str))
    return result


async def load_pricing_tables(db):
    tables = {}
    for model in (VehiclePrice, BatteryPrice, Accessory, RollingCost, Promotion, Dealer, PricingPolicy):
        result = await db.execute(select(model))
        tables[model.__tablename__] = [
            {c.name: getattr(row, c.name) for c in model.__table__.columns} for row in result.scalars().all()
        ]
    return tables


async def price_configuration(req, db, subject=None):
    from src.services.customer_sessions import eligibility_tables

    tables = await load_pricing_tables(db)
    if subject:
        tables.update(await eligibility_tables(subject, db))
        if not req.customer_claims:
            profile = subject.profile or {}
            claims = {**(profile.get("customer_claims", {}) or {}),
                      **{key: profile[key] for key in ("vinclub_tier", "customer_group", "purchase_channel")
                         if profile.get(key) is not None}}
            req = req.model_copy(update={"customer_claims": claims})
    return calculate_price(req, tables)
