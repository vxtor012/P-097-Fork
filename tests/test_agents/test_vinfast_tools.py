import json

from src.agents.tools.vinfast_tools import (
    calculate_vehicle_tco,
    lookup_car_color_options,
    lookup_province_fees,
    search_vehicles,
)


def test_search_vehicles_reads_supabase_catalog():
    result = json.loads(search_vehicles.invoke({
        "vehicle_queries": ["VF 6"],
        "fields": ["price", "colors"],
    }))

    assert len(result["matched_versions"]) >= 1
    assert result["matched_versions"][0]["price_vnd"] > 0
    assert result["matched_versions"][0]["exterior_colors"]
    assert result["matched_versions"][0]["exterior_colors"][0]["color_hex"].startswith("#")
    assert result["catalog_source"] == "supabase/ai_data@test"


def test_lookup_car_color_options_reads_supabase_catalog():
    result = json.loads(lookup_car_color_options.invoke({"vehicle_queries": ["VF 6"]}))

    assert result["color_options"]
    assert result["color_options"][0]["color"]
    assert result["catalog_source"] == "supabase/ai_data/vehicle_colors@test"


def test_lookup_province_fees_reads_supabase_catalog():
    result = json.loads(lookup_province_fees.invoke({"province": "Hà Nội"}))

    assert result["fees"]["province"] == "Hà Nội"
    assert result["fees"]["car_license_plate_fee_vnd"] == 14_000_000
    assert result["fees"]["car_registration_fee_percent"] == 0
    assert result["catalog_source"] == "supabase/ai_data/provinces@test"


def test_calculate_vehicle_tco_uses_province_rolling_cost_matrix():
    result = json.loads(calculate_vehicle_tco.invoke({
        "vehicle_queries": ["VF 6 Plus"],
        "years": 5,
        "location": "Hà Nội",
    }))

    assert result["tco"][0]["initial_cost_vnd"] == 715_380_700
    assert result["tco"][0]["location"] == "Hà Nội"


def test_calculate_vehicle_tco_keeps_ev_registration_exemption():
    result = json.loads(calculate_vehicle_tco.invoke({
        "vehicle_queries": ["VF 6 Plus"],
        "years": 5,
        "location": "Bà Rịa Vũng Tàu",
    }))

    assert result["tco"][0]["initial_cost_vnd"] == 702_380_700


def test_tco_does_not_use_rental_cost_for_a_purchase_configuration():
    from src import ai_data

    rows = ai_data.catalog_snapshot("test")
    rows["trims_pricing"][0]["battery_option"] = "Kèm pin (mua đứt)"
    for row in rows["rolling_cost_matrix"]:
        row["battery_option"] = "Thuê Pin"
    result = json.loads(calculate_vehicle_tco.invoke({
        "vehicle_queries": ["VF 6 Plus"], "years": 5, "location": "Hà Nội",
    }))
    assert "initial_cost_vnd" not in result["tco"][0]
    assert "note" in result["tco"][0]
    assert rows["trims_pricing"][0]["battery_option"] == "Kèm pin (mua đứt)"
