"""Live public catalog for structured AI tools; RAG remains in ai_data.

A repeatable-read snapshot is held for one agent invocation, never cached across
requests. Seller updates are visible on the next request.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from functools import wraps
from types import SimpleNamespace

from src.ai_data import cursor
from src.services.pricing import calculate_price

_tables = ContextVar("operational_tables", default=None)
TABLE_NAMES = ("vehicle_prices", "battery_prices", "accessories", "rolling_costs", "promotions", 'dealers')


def load_tables():
    tables = {}
    with cursor() as cur:
        cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        for name in TABLE_NAMES:
            # Identifiers come exclusively from this module's fixed allowlist.
            cur.execute(f"SELECT * FROM public.{name}")
            tables[name] = [dict(row) for row in cur.fetchall()]
    return tables


@contextmanager
def dataset_scope():
    if _tables.get() is not None:
        yield
        return
    token = _tables.set(load_tables())
    try:
        yield
    finally:
        _tables.reset(token)


def pinned(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with dataset_scope():
            return function(*args, **kwargs)

    return wrapped


def provenance(table=None):
    return "postgresql/public" + (f"/{table}" if table else "")


def catalog_rows(name):
    """Adapt live operational records to the existing tool response vocabulary."""
    tables = _tables.get()
    if tables is None:
        with dataset_scope():
            return catalog_rows(name)
    now = datetime.now(UTC).replace(tzinfo=None)
    prices = [
        v
        for v in tables["vehicle_prices"]
        if v["effective_from"] <= now and (v["effective_to"] is None or v["effective_to"] > now)
    ]
    name = name.removesuffix(".csv")
    if name == "cars_catalog":
        return [
            {"car_id": m, "car_name": m, "vehicle_type": "electric car"} for m in sorted({v["model"] for v in prices})
        ]
    if name == "trims_pricing":
        seen = set()
        rows = []
        for v in sorted(prices, key=lambda r: (r["model"], r["version"], r["price"])):
            key = (v["model"], v["version"])
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "car_id": v["model"],
                    "car_name": v["model"],
                    "trim_id": v["version"],
                    "trim_name": v["version"],
                    "product_code": v["version"],
                    "price_vat_vnd": str(v["price"]),
                    "battery_option": "rent",
                    "price_version": v["price_version"],
                }
            )
        return rows
    if name == "vehicle_colors":
        minimum = {(r["car_id"], r["trim_name"]): int(r["price_vat_vnd"]) for r in catalog_rows("trims_pricing")}
        return [
            {
                "car_id": v["model"],
                "trim_code": v["version"],
                "color_name": v["color"],
                "color_name_vi": v["color"],
                "color_code": v["color"],
                "color_hex": v["color_hex"],
                "color_extra_price_vnd": str(v["price"] - minimum[(v["model"], v["version"])]),
                "is_available": "true",
                "image_url": v["image_url"] or "",
            }
            for v in prices
        ]
    if name == "provinces":
        return [
            {
                "province_name": r["province"],
                "province_id": r["province"],
                "zone": "",
                "car_registration_fee_pct": str(r["registration_rate"]),
                "car_license_plate_fee_vnd": str(r["plate_fee"]),
                "bike_license_fee_low_vnd": "",
                "bike_license_fee_medium_vnd": "",
                "bike_license_fee_high_vnd": "",
                "bike_registration_fee_pct": "",
            }
            for r in tables["rolling_costs"]
        ]
    if name == "rolling_cost_matrix":
        rows = []
        for trim in catalog_rows("trims_pricing"):
            vehicle = min(
                (v for v in prices if v["model"] == trim["car_id"] and v["version"] == trim["trim_name"]),
                key=lambda v: v["price"],
            )
            for fees in tables["rolling_costs"]:
                req = SimpleNamespace(
                    model=vehicle["model"],
                    version=vehicle["version"],
                    color=vehicle["color"],
                    battery="rent",
                    province=fees["province"],
                    accessories=[],
                )
                # TCO deliberately excludes promotions, as stated in tool output.
                cost = calculate_price(req, {**tables, "promotions": []}, now)
                rows.append(
                    {
                        **trim,
                        "province_name": fees["province"],
                        "total_rolling_cost_vnd": str(cost["final_price"]),
                        "road_fee_vnd": str(cost["rolling_costs"]["road_fee"]),
                        "mandatory_insurance_vnd": str(cost["rolling_costs"]["insurance"]),
                    }
                )
        return rows
    if name == "promotions":
        return [
            {
                "promo_name": p["name"],
                "benefit_type": "cash_discount",
                "is_active": str(p["is_active"]).lower(),
                "valid_from": p["start_date"].date().isoformat(),
                "valid_to": p["end_date"].date().isoformat(),
                "audience": "all",
                "applies_to": "" if p["model"] == "ALL" else p["model"],
                "discount_percent": str(p["discount_value"]) if str(p["discount_type"]) == "percent" else "0",
                "discount_amount_vnd": str(p["discount_value"]) if str(p["discount_type"]) == "fixed" else "0",
                "description": p["description"] or "",
                "stack_policy": "not_stackable",
                "province": p["province"],
                "dealer_id": str(p["dealer_id"]) if p["dealer_id"] else None,
                "conditions": p["conditions"] or {},
                "start_date": p["start_date"],
                "end_date": p["end_date"],
            }
            for p in tables["promotions"]
        ]
    raise ValueError(f"Unsupported operational catalog: {name}")


def price_configuration(request):
    with dataset_scope():
        return calculate_price(request, _tables.get())
