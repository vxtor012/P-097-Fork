import json

import pytest

from scripts.db import import_ai_data as importer
from tests.ai_fixtures import write_source


def test_source_retains_rows_and_is_repeatable(tmp_path):
    original = write_source(tmp_path)
    first = importer.read_source(tmp_path)
    second = importer.read_source(tmp_path)
    assert first == second
    assert first["records"] == original
    assert first["catalog"]["trims_pricing"][0]["price_vat_vnd"] == "699000000"


@pytest.mark.parametrize("bad", [[0] * 1536, [1, 2], [float("nan")] * 1536, [True] * 1536])
def test_bad_vectors_are_rejected(bad):
    with pytest.raises(ValueError, match="embedding"):
        importer.validate_vector(bad, "test record")


def test_duplicate_record_is_rejected(tmp_path):
    records = write_source(tmp_path)
    with (tmp_path / "vinfast_embeddings.jsonl").open("a") as source:
        source.write("\n" + json.dumps(records[0]))
    with pytest.raises(ValueError, match="duplicate"):
        importer.read_source(tmp_path)


def test_unknown_car_reference_is_rejected(tmp_path):
    write_source(tmp_path)
    file = tmp_path / "rdb_schema" / "cars_catalog.csv"
    lines = file.read_text().splitlines()
    file.write_text("\n".join([lines[0], *lines[2:]]))
    with pytest.raises(ValueError, match="unknown car_id"):
        importer.read_source(tmp_path)


def test_web_sources_reject_unlisted_domain():
    with pytest.raises(ValueError, match="allowlist"):
        importer.validate_web({"allowed_domains": ["example.com"], "sources": {"test": ["https://other.example/test"]}})
