"""Small invented catalog; contains no imported private source records."""

import csv
import json

from scripts.db.import_ai_data import HEADERS, TABLES


def catalog():
    tables = {name: [] for name in TABLES}
    for index, (model, trim, code) in enumerate([
        ("VF 6", "VF6 Plus", "C6"), ("VF 8", "VF8 Eco", "C8"),
        ("EC Van", "PAK2", "VAN_A"), ("VF 2", "VF2", "C2"),
    ]):
        car_id = str(index)
        tables["cars_catalog"].append({"car_id": car_id, "car_name": model, "vehicle_type": "electric car"})
        tables["trims_pricing"].append({"trim_id": car_id, "car_id": car_id, "car_name": model,
                                        "trim_name": trim, "price_vat_vnd": "699000000", "product_code": code,
                                        "battery_option": "buy"})
        tables["vehicle_colors"].append({"car_id": car_id, "trim_code": "VAN" if model == "EC Van" else code,
                                         "color_name": "Example White", "color_name_vi": "Trắng thử nghiệm",
                                         "color_code": "WHITE", "color_hex": "#FFFFFF", "color_extra_price_vnd": "1000000",
                                         "is_available": "false" if model == "VF 2" else "true"})
    for index, province in enumerate(["Hà Nội", "TP. Hồ Chí Minh", "Thừa Thiên Huế", "Bà Rịa Vũng Tàu"]):
        tables["provinces"].append({"province_id": str(index), "province_name": province,
                                    "zone": "test", "car_license_plate_fee_vnd": "14000000",
                                    "car_registration_fee_pct": "0", "bike_license_fee_low_vnd": "0",
                                    "bike_license_fee_medium_vnd": "0", "bike_license_fee_high_vnd": "0",
                                    "bike_registration_fee_pct": "0"})
        tables["rolling_cost_matrix"].append({"car_id": "0", "car_name": "VF 6", "trim_name": "VF6 Plus",
                                              "battery_option": "buy", "province_name": province,
                                              "total_rolling_cost_vnd": "702380700" if index == 3 else "715380700",
                                              "road_fee_vnd": "1000000", "mandatory_insurance_vnd": "500000"})
    for index, (name, audience, tier, channel, benefit) in enumerate([
        ("Hạng Platinum", "vinclub_tier", "platinum", "", "cash_discount"),
        ("Voucher thử nghiệm", "green_switch", "", "", "voucher"),
        ("Online thử nghiệm", "", "", "O2O", "fixed_discount"),
    ]):
        tables["promotions"].append({"promo_id": str(index), "promo_name": name, "audience": audience,
                                    "tier": tier, "channel": channel, "benefit_type": benefit,
                                    "is_active": "true", "valid_from": "2020-01-01", "valid_to": "2026-12-31",
                                    "discount_percent": "3", "loyalty_percent": "3", "applies_to": "",
                                    "voucher_values": "Fadil=30000000|Lux A2.0=60000000|Lux SA2.0=80000000"})
    return tables


def write_source(directory):
    tables = catalog()
    (directory / "rdb_schema").mkdir()
    for name, rows in tables.items():
        fields = sorted(HEADERS[name] | {key for row in rows for key in row})
        with (directory / "rdb_schema" / f"{name}.csv").open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fields)
            writer.writeheader()
            writer.writerows(rows)
    records = [
        {"record_type": "chunk", "chunk_id": f"test-{index}", "content": f"Invented passage {index}",
         "metadata": {"gold_topic": "pin_va_tram_sac" if index == 0 else "thong_so_va_chon_xe"},
         "embedding_model": "text-embedding-3-small", "embedding": vector + [0.0] * 1534}
        for index, vector in enumerate([[1.0, 0.0], [0.8, 0.6], [0.0, 1.0]])
    ]
    (directory / "vinfast_embeddings.jsonl").write_text("\n".join(json.dumps(r) for r in records), encoding="utf-8")
    return records
