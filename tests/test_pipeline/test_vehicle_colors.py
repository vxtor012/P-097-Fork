"""Tests for vehicle color and configuration extraction in RelationalExtractor."""

from pathlib import Path

from src.pipeline.extractors.relational_extractor import RelationalExtractor


def test_vehicle_colors_extracted():
    extractor = RelationalExtractor(bronze_dir=Path("dataset/bronze"))
    vehicles = extractor.get_structured_vehicles()

    assert len(vehicles) > 0

    vf3 = next((v for v in vehicles if "VF 3" in v.model_name or "VF3" in v.vehicle_id), None)
    assert vf3 is not None
    assert len(vf3.colors) >= 7
    assert len(vf3.trims) >= 1
    assert "Bảng màu sắc ngọai thất chính hãng" in vf3.searchable_markdown or "Bảng màu sắc ngoại thất chính hãng" in vf3.searchable_markdown

    # Verify color item structure
    first_color = vf3.colors[0]
    assert "color_code" in first_color
    assert "color_name" in first_color
    assert "color_name_vi" in first_color
    assert "color_hex" in first_color
    assert first_color["color_hex"].startswith("#")


def test_relational_vehicle_colors_table():
    extractor = RelationalExtractor(bronze_dir=Path("dataset/bronze"))
    tables = extractor.get_relational_tables(cars_only=True)

    assert "vehicle_colors" in tables
    colors_table = tables["vehicle_colors"]
    assert len(colors_table) > 50

    sample = colors_table[0]
    for required_col in ["car_id", "car_name", "trim_code", "trim_name", "color_code", "color_name_vi", "color_hex"]:
        assert required_col in sample
        assert sample[required_col]
