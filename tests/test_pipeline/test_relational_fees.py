"""Phí biển số phải đến từ snapshot, không dùng số cũ hard-code."""

import json

import pytest

from src.pipeline.extractors.relational_extractor import RelationalExtractor


def _snapshot(kv1_fee, color_price):
    color = {"label": "Red", "code": "#ff0000"}
    if color_price is not None:
        color["price"] = {"value": color_price}
    return {
        "vehicles": {"cars": {
            "models": [{"id": "Products-Car-X", "name": "X"}],
            "Products-Car-X": {"listEdition": ["E1"], "E1": {"label": "Plus", "priceValue": 500_000_000, "listColor": ["C1"], "C1": color}},
        }},
        "objects": {
            "costs": [{"model": "Products-Car-X", "ID": "Plus", "price": 500_000_000, "edition": "E1"}],
            "provinces": [{"id": "1", "name": "Hà Nội", "zone": "KV1"}, {"id": "2", "name": "Nghệ An", "zone": "KV2"}],
            "fees": [{"zone": "KV1", "carLicenseFee": kv1_fee}, {"zone": "KV2", "carLicenseFee": 1_000_000}],
        },
    }


def _extract(tmp_path, snapshot):
    path = tmp_path / "vinfast" / "relational"
    path.mkdir(parents=True)
    (path / "vinfast_rolling_raw_snapshot.json").write_text(json.dumps(snapshot), encoding="utf-8")
    return RelationalExtractor(bronze_dir=tmp_path).get_relational_tables(cars_only=True)


def test_plate_fee_comes_from_snapshot(tmp_path):
    tables = _extract(tmp_path, _snapshot(14_000_000, 500_000_000))
    rules = {r["fee_code"]: r for r in tables["fee_rules"]}
    assert rules["PLATE_FEE_HN_HCM"]["fixed_amount_vnd"] == 14_000_000
    hn = next(r for r in tables["rolling_cost_matrix"] if r["province_name"] == "Hà Nội")
    assert hn["license_plate_fee_vnd"] == 14_000_000
    assert hn["total_rolling_cost_vnd"] == 500_000_000 + 14_000_000 + 340_000 + 1_560_000 + 480_700


def test_missing_plate_fee_fails_loudly(tmp_path):
    snapshot = _snapshot(None, 500_000_000)
    with pytest.raises(ValueError):
        _extract(tmp_path, snapshot)


def test_missing_color_price_is_unknown_not_free(tmp_path):
    tables = _extract(tmp_path, _snapshot(14_000_000, None))
    color = tables["vehicle_colors"][0]
    assert color["color_type"] == "" and color["color_extra_price_vnd"] == ""
    assert color["is_available"] == ""


def test_markdown_uses_snapshot_fee(tmp_path):
    path = tmp_path / "vinfast" / "relational"
    path.mkdir(parents=True)
    (path / "vinfast_rolling_raw_snapshot.json").write_text(json.dumps(_snapshot(14_000_000, 500_000_000)), encoding="utf-8")
    vehicle = RelationalExtractor(bronze_dir=tmp_path).get_structured_vehicles()
    assert vehicle and "14.000.000" in vehicle[0].searchable_markdown and "20.000.000" not in vehicle[0].searchable_markdown


def test_color_surcharge_uses_cheapest_color_as_base(tmp_path):
    """priceValue của snapshot có thể là giá màu cao cấp; phụ phí phải tính từ màu rẻ nhất."""
    snapshot = _snapshot(14_000_000, 296_000_000)
    edition = snapshot["vehicles"]["cars"]["Products-Car-X"]["E1"]
    edition["priceValue"] = 304_000_000
    edition["listColor"] = ["C1", "C2"]
    edition["C2"] = {"label": "Premium", "code": "#000000", "price": {"value": 304_000_000}}
    rows = _extract(tmp_path, snapshot)["vehicle_colors"]
    by_code = {r["color_code"]: r for r in rows}
    assert by_code["C1"]["color_extra_price_vnd"] == 0 and by_code["C1"]["color_type"] == "Màu cơ bản"
    assert by_code["C2"]["color_extra_price_vnd"] == 8_000_000 and by_code["C2"]["color_type"] == "Màu nâng cao"


def test_promotions_table_from_snapshot(tmp_path):
    snapshot = _snapshot(14_000_000, 500_000_000)
    snapshot["promotion"] = {"records": [
        {"ID": "member_tier_platinum", "type": "vinclubTier", "name": "Hạng Platinum", "active": True, "discountPercent": 3,
         "description": "Ưu đãi 6%, trong đó giảm giá 3% và tích điểm chi tiêu 3%"},
        {"ID": "member_tier_gold", "type": "vinclubTier", "name": "Hạng Gold", "active": True, "discountPercent": 1.5,
         "description": "Ưu đãi 3%, trong đó giảm giá 1,5% và tích điểm chi tiêu 1,5%"},
        {"ID": "member_tier_0", "type": "vinclubTier", "name": "Không áp dụng", "active": True, "discountPercent": 0,
         "description": "Không áp dụng"},
        {"ID": "green", "type": "green", "name": "Chuyển đổi Xanh", "active": True,
         "description": "Voucher có giá trị sử dụng đến hết 31/12/2026.",
         "campaign": json.dumps({"onlineFrom": "2026-08-01T00:00:00+07:00", "vehicles": [{"name": "VinFast Fadil", "value": 30000000}]})},
    ]}
    rows = {r["promo_id"]: r for r in _extract(tmp_path, snapshot)["promotions"]}
    assert set(rows) == {"member_tier_platinum", "member_tier_gold", "green"}  # hạng 0 không có quyền lợi
    assert rows["member_tier_gold"]["discount_percent"] == "1.5" and rows["member_tier_gold"]["loyalty_percent"] == "1.5"
    assert rows["member_tier_platinum"]["tier"] == "platinum" and rows["member_tier_platinum"]["audience"] == "vinclub_tier"
    green = rows["green"]
    assert green["benefit_type"] == "voucher" and green["voucher_values"] == "VinFast Fadil=30000000"
    assert green["valid_from"] == "2026-08-01" and green["valid_to"] == "2026-12-31"
    assert all(r["stack_policy"] == "unknown" for r in rows.values())
