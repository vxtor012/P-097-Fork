"""Read-only audit of operational data readiness; never seeds or changes records."""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.models.schemas import ConfigRequest  # noqa: E402
from src.operational_data import load_tables  # noqa: E402
from src.services.pricing import calculate_price  # noqa: E402


def main():
    try:
        tables = load_tables()
        now = datetime.now(UTC).replace(tzinfo=None)
        active = [
            v
            for v in tables["vehicle_prices"]
            if v["effective_from"] <= now and (v["effective_to"] is None or v["effective_to"] > now)
        ]
        missing_batteries = sorted({v["model"] for v in active} - {b["model"] for b in tables["battery_prices"]})
        problems = []
        for v in active:
            for province in tables["rolling_costs"]:
                req = ConfigRequest(
                    model=v["model"],
                    version=v["version"],
                    color=v["color"],
                    province=province["province"],
                    battery="rent",
                )
                try:
                    calculate_price(req, tables, now)
                except Exception as error:
                    problems.append(
                        {
                            "model": v["model"],
                            "version": v["version"],
                            "province": province["province"],
                            "error_type": type(error).__name__,
                        }
                    )
        ready = bool(active and tables["rolling_costs"]) and not missing_batteries and not problems
        print(
            json.dumps(
                {
                    "data_source": "postgresql/public",
                    "ready": ready,
                    "counts": {name: len(rows) for name, rows in tables.items()},
                    "active_vehicle_prices": len(active),
                    "price_versions": sorted({v["price_version"] for v in active}),
                    "missing_batteries": missing_batteries,
                    "pricing_problems": problems,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if ready else 1
    except Exception as error:
        # Database exceptions may contain URLs/passwords. Never print their text.
        print(
            json.dumps(
                {
                    "ready": False,
                    "error_type": type(error).__name__,
                    "message": "Cannot audit configured database; check connectivity and public schema.",
                }
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
