"""Plan, apply, or check a coherent demo dataset without writing catalog data."""

import argparse
import asyncio
import hashlib
import json
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.db.migrate_supabase import OperationError, connection_url, target_label  # noqa: E402

TAG = "autoquote-demo-v1"
NAMESPACE = uuid.UUID("9345c572-384c-4dbe-835a-47b23864315d")
PROTECTED = ("vehicle_prices", "battery_prices", "accessories", "rolling_costs", "promotions", "dealers")
BUSINESS = ("users", "chat_sessions", "leads", "quotes", "inventory")


def identifier(key):
    return str(uuid.uuid5(NAMESPACE, f"{TAG}:{key}"))


def stamp(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def serialize(value):
    if isinstance(value, (datetime, uuid.UUID)):
        return str(value)
    raise TypeError(type(value).__name__)


def digest(rows):
    return hashlib.sha256(json.dumps(rows, sort_keys=True, default=serialize).encode()).hexdigest()


def price_snapshot(data, vehicle, province, battery, codes, at):
    """Match /configurate arithmetic; preserve source IDs and the calculation date."""
    base = int(vehicle["price"])
    bat = next((r for r in data["battery_prices"] if r["model"] == vehicle["model"]), None)
    battery_cost = int(bat["buy_price"]) if bat and battery == "buy" else 0
    accessories = [r for r in data["accessories"] if r["code"] in codes]
    fees = next((r for r in data["rolling_costs"] if r["province"] == province), None)
    fees = fees or next((r for r in data["rolling_costs"] if r["province"] == "Tỉnh khác"), None)
    if not fees:
        raise OperationError("Missing rolling costs for the demo province or Tỉnh khác")
    rolling = {"registration_fee": int(base * fees["registration_rate"]),
               "road_fee": int(fees["road_fee"]), "inspection_fee": int(fees["inspection_fee"]),
               "insurance": int(base * fees["insurance_rate"]), "plate_fee": int(fees["plate_fee"])}
    promos = []
    for row in sorted(data["promotions"], key=lambda r: r["id"]):
        if not row["is_active"] or not stamp(row["start_date"]) <= at <= stamp(row["end_date"]):
            continue
        if row["model"] not in ("ALL", vehicle["model"]) or row["province"] not in (None, province):
            continue
        value = int(row["discount_value"]) if row["discount_type"] == "fixed" else int(base * row["discount_value"] / 100)
        promos.append({"id": row["id"], "name": row["name"], "value": value,
                       "source": "dealer" if row["dealer_id"] else "vinfast_national"})
    discount = sum(p["value"] for p in promos)
    final = base + battery_cost + sum(int(a["price"]) for a in accessories) + sum(rolling.values()) - discount
    if final < 0:
        raise OperationError("Catalog promotions yield a negative quote; correct source data separately")
    return {"base_price": base, "battery_cost": battery_cost,
            "accessories": [{"code": a["code"], "name": a["name"], "price": a["price"]} for a in accessories],
            "rolling_costs": rolling, "promotions": promos, "total_discount": discount,
            "final_price": final, "province": province, "price_version": vehicle["price_version"],
            "vehicle_price_id": vehicle["id"], "calculated_at": at.isoformat(), "mock_dataset": TAG}


def build_plan(data, as_of, adopt=False, count=42, quote_count=31):
    """Keep existing lead/quote IDs; regenerate only explicitly adopted demo rows."""
    existing_leads = sorted(data.get("leads") or [], key=lambda r: r["id"])
    existing_quotes = sorted(data.get("quotes") or [], key=lambda r: r["id"])
    unmarked = (any(not (r.get("note") or "").startswith(TAG) for r in existing_leads)
                or any(not (r.get("seller_note") or "").startswith(TAG) for r in existing_quotes)
                or any((r.get("config_snapshot") or {}).get("mock_dataset") != TAG for r in data.get("chat_sessions", []))
                or any(not (r.get("est_delivery") or "").startswith(TAG) for r in data.get("inventory", [])))
    if unmarked and not adopt:
        raise OperationError("Unmarked business rows exist. Use --adopt-existing-mock only when these rows are confirmed fake; back up first")
    # Chats/inventory are not removed or silently adopted: unrelated rows need a separate review.
    if any((r.get("config_snapshot") or {}).get("mock_dataset") != TAG for r in data.get("chat_sessions", [])):
        raise OperationError("Unmarked chat sessions exist; preserve/reconcile them separately before applying")
    if any(not (r.get("est_delivery") or "").startswith(TAG) for r in data.get("inventory", [])):
        raise OperationError("Unmarked inventory exists; preserve/reconcile it separately before applying")
    dealers = sorted([r for r in data["dealers"] if r["is_active"]], key=lambda r: r["id"])
    vehicles = sorted([r for r in data["vehicle_prices"] if r["effective_to"] is None and stamp(r["effective_from"]) <= as_of],
                      key=lambda r: (r["model"], r["version"], r["color"]))
    if not dealers or not vehicles:
        raise OperationError("Load an active dealer and effective vehicle catalog first; mock seeding never creates prices or promotions")
    quote_count = max(quote_count, len(existing_quotes))
    count = max(count, len(existing_leads), quote_count)
    def stable_ids(existing, total, kind):
        result = {r["id"] for r in existing}
        i = 0
        while len(result) < total:
            result.add(identifier(f"{kind}:{i}"))
            i += 1
        return sorted(result)
    lead_ids = stable_ids(existing_leads, count, "lead")
    quote_ids = stable_ids(existing_quotes, quote_count, "quote")
    rows = {table: [] for table in BUSINESS}
    if not any(r["role"] == "admin" and r.get("is_active", True) for r in data["users"]):
        rows["users"].append({"id": identifier("admin"), "email": "demo.admin@example.invalid",
            "name": "Quản trị Demo", "hashed_pw": "!disabled-demo-account", "role": "admin",
            "dealer_id": None, "is_active": True, "created_at": as_of - timedelta(days=60)})
    staff = {}
    for dealer in dealers:
        for role in ("seller", "warehouse"):
            staff_id = identifier(f"{role}:{dealer['id']}")
            candidates = [r for r in data["users"] if r["role"] == role and r["dealer_id"] == dealer["id"] and r.get("is_active", True)]
            candidates.sort(key=lambda r: (r["id"] == staff_id, r["id"]))
            if candidates:
                staff_id = candidates[0]["id"]
            else:
                rows["users"].append({"id": staff_id, "email": f"demo.{role}.{dealer['id']}@example.invalid",
                    "name": f"Demo {role} — {dealer['name']}", "hashed_pw": "!disabled-demo-account",
                    "role": role, "dealer_id": dealer["id"], "is_active": True,
                    "created_at": as_of - timedelta(days=60)})
            staff[(dealer["id"], role)] = staff_id
    for i in range(count):
        lead_id = lead_ids[i]
        buyer_id = identifier(f"buyer:{lead_id}")
        session_id = f"demo-{lead_id}"
        dealer = dealers[i % len(dealers)]
        vehicle = vehicles[i % len(vehicles)]
        # Only a currently effective catalog row; quote time cannot precede its effective date.
        status = ("pending", "approved", "rejected", "expired")[i % 4] if i < quote_count else None
        age = 1 + i % 3 if status == "pending" else (10 + i % 20 if status == "expired" else 1 + i % 20)
        created = max(as_of - timedelta(days=age), stamp(vehicle["effective_from"]))
        calculated = created + timedelta(minutes=10)
        if calculated > as_of:
            raise OperationError("Reference date is too early to build a conversation for the effective catalog")
        if status == "expired" and calculated + timedelta(days=7) > as_of:
            status = "pending"
        name, phone = f"Khách Demo {i + 1:02d}", f"090{i + 1:07d}"
        battery = "rent" if i % 3 == 0 else "buy"
        available = sorted([a for a in data["accessories"] if a["is_active"]
                            and (not a["compatible_models"] or vehicle["model"] in a["compatible_models"])], key=lambda a: a["code"])
        codes = [a["code"] for a in available[:i % 3]]
        snapshot = price_snapshot(data, vehicle, dealer["province"], battery, codes, calculated)
        lead_status = {"pending": "quoted", "approved": "closed_won", "rejected": "closed_lost", "expired": "closed_lost"}.get(status)
        lead_status = lead_status or ("new" if i % 2 == 0 else "contacted")
        reviewed = calculated + timedelta(hours=4) if status in ("approved", "rejected") else None
        updated = reviewed or (calculated + timedelta(days=7) if status == "expired" else calculated)
        config = {"mock_dataset": TAG, "buyer_id": buyer_id, "lead_id": lead_id,
                  "buyer_name": name, "buyer_phone": phone,
                  "dealer_id": dealer["id"], "seller_id": staff[(dealer["id"], "seller")],
                  "model": vehicle["model"], "version": vehicle["version"], "color": vehicle["color"],
                  "battery": battery, "province": dealer["province"], "accessories": codes}
        rows["users"].append({"id": buyer_id, "email": f"demo.buyer.{lead_id}@example.invalid", "name": name,
            "hashed_pw": "!disabled-demo-account", "role": "buyer", "dealer_id": None, "is_active": True,
            "created_at": created - timedelta(days=1)})
        rows["leads"].append({"id": lead_id, "session_id": session_id, "name": name, "phone": phone,
            "province": dealer["province"], "interested_in": f"{vehicle['model']} {vehicle['version']}",
            "budget": ((snapshot["final_price"] + 49999999) // 50000000) * 50000000,
            "note": f"{TAG}: dữ liệu giả lập; buyer={buyer_id}; trạng thái={lead_status}",
            "status": lead_status, "dealer_id": dealer["id"], "assigned_to": staff[(dealer["id"], "seller")],
            "created_at": created, "updated_at": updated})
        messages = [{"role": "user", "content": f"Tôi là {name}, muốn tìm hiểu {vehicle['model']} {vehicle['version']} tại {dealer['province']}.", "created_at": created.isoformat()},
                    {"role": "assistant", "content": f"Anh/chị chọn màu {vehicle['color']}, phương án pin {battery}. Đại lý tư vấn: {dealer['name']}.", "created_at": (created + timedelta(minutes=1)).isoformat()}]
        if status:
            quote_id = quote_ids[i]
            config["quote_id"] = quote_id
            messages.extend([{"role": "user", "content": "Vui lòng lập báo giá theo cấu hình này.", "created_at": (calculated - timedelta(minutes=1)).isoformat()},
                             {"role": "assistant", "content": f"Báo giá {quote_id}: {snapshot['final_price']:,} VND, phiên bản giá {vehicle['price_version']}.", "created_at": calculated.isoformat()}])
            messages.append({"role": "assistant", "content": f"Trạng thái báo giá: {status}.", "created_at": updated.isoformat()})
            rows["quotes"].append({"id": quote_id, "session_id": session_id, "lead_id": lead_id,
                "buyer_name": name, "buyer_phone": phone, "model": vehicle["model"], "version": vehicle["version"],
                "color": vehicle["color"], "battery": battery, "province": dealer["province"], "accessories": codes,
                "price_snapshot": snapshot, "price_version": vehicle["price_version"], "final_price": snapshot["final_price"],
                "status": status, "seller_id": staff[(dealer["id"], "seller")],
                "seller_note": f"{TAG}: {status}; chỉ dùng demo", "pdf_url": None,
                "created_at": calculated, "reviewed_at": reviewed})
        rows["chat_sessions"].append({"id": identifier(f"chat:{lead_id}"), "session_id": session_id,
            "messages": messages, "config_snapshot": config,
            "ai_summary": f"{TAG}: {name}; {vehicle['model']} {vehicle['version']}; {lead_status}",
            "created_at": created, "updated_at": updated})
    # Catalog configurations at every dealer; stock quantity and updater are mock only.
    for dealer in dealers:
        for i, vehicle in enumerate(vehicles):
            quantity = i % 6
            rows["inventory"].append({"id": identifier(f"stock:{dealer['id']}:{vehicle['model']}:{vehicle['version']}:{vehicle['color']}"),
                "dealer_id": dealer["id"], "model": vehicle["model"], "version": vehicle["version"], "color": vehicle["color"],
                "color_hex": vehicle["color_hex"], "quantity": quantity,
                "est_delivery": f"{TAG}: " + ("Giao ngay" if quantity else "2–3 tuần"),
                "updated_by": staff[(dealer["id"], "warehouse")], "updated_at": as_of})
    return rows


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return "ARRAY[" + ",".join(literal(v) for v in value) + "]::varchar[]"
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, default=serialize)
    return "'" + str(value).replace("'", "''") + "'"


def fingerprint_sql(table):
    if table not in PROTECTED + BUSINESS:
        raise ValueError("Unknown table")
    return f"SELECT md5(COALESCE(string_agg(to_jsonb(t)::text, '' ORDER BY id), '')) FROM public.{table} t"


def assertion_sql(fingerprints):
    checks = "\n".join(f"IF ({fingerprint_sql(table)}) <> {literal(value)} THEN RAISE EXCEPTION 'Data changed: {table}'; END IF;"
                       for table, value in fingerprints.items())
    return "DO $guard$ BEGIN\n" + checks + "\nEND $guard$;"


def render_sql(plan, fingerprints):
    """Guard the reviewed snapshot and protected catalog in the same transaction."""
    parts = ["BEGIN;", "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';",
             "SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=public,pg_catalog;",
             "SELECT pg_advisory_xact_lock(97004);",
             "LOCK TABLE " + ",".join("public." + t for t in PROTECTED + BUSINESS) + " IN SHARE ROW EXCLUSIVE MODE;",
             assertion_sql(fingerprints)]
    for table, records in plan.items():
        if not records:
            continue
        columns = list(records[0])
        values = ",\n".join("(" + ",".join(literal(row[c]) for c in columns) + ")" for row in records)
        update = ",".join(f"{c}=excluded.{c}" for c in columns if c != "id")
        # Existing users are never edited, including staff referenced by promotions.
        conflict = "(id) DO NOTHING" if table == "users" else f"(id) DO UPDATE SET {update}"
        parts.append(f"INSERT INTO public.{table} ({','.join(columns)}) VALUES\n{values}\nON CONFLICT {conflict};")
    parts.append(assertion_sql({t: fingerprints[t] for t in PROTECTED}))
    parts.append("DO $verify$ BEGIN IF EXISTS (SELECT 1 FROM (" + INTEGRITY_SQL + ") checks WHERE errors > 0) THEN RAISE EXCEPTION 'Mock integrity failed'; END IF; END $verify$;")
    parts.append("COMMIT;")
    return "\n\n".join(parts)


INTEGRITY_SQL = """
SELECT 'lead_chat_buyer' AS check_name, count(*) AS errors FROM public.leads l
LEFT JOIN public.chat_sessions c ON c.session_id=l.session_id
LEFT JOIN public.users b ON b.id::text=c.config_snapshot->>'buyer_id'
WHERE c.id IS NULL OR b.id IS NULL OR b.role::text<>'buyer' OR b.name IS DISTINCT FROM l.name
   OR c.config_snapshot->>'lead_id' IS DISTINCT FROM l.id::text
   OR c.config_snapshot->>'buyer_name' IS DISTINCT FROM l.name OR c.config_snapshot->>'buyer_phone' IS DISTINCT FROM l.phone
UNION ALL
SELECT 'lead_staff_dealer',count(*) FROM public.leads l LEFT JOIN public.users s ON s.id=l.assigned_to
LEFT JOIN public.dealers d ON d.id=l.dealer_id
WHERE d.id IS NULL OR s.id IS NULL OR s.role::text<>'seller' OR s.dealer_id IS DISTINCT FROM l.dealer_id OR d.province IS DISTINCT FROM l.province
UNION ALL
SELECT 'quote_chain',count(*) FROM public.quotes q LEFT JOIN public.leads l ON l.id=q.lead_id
LEFT JOIN public.chat_sessions c ON c.session_id=q.session_id LEFT JOIN public.users s ON s.id=q.seller_id
WHERE l.id IS NULL OR c.id IS NULL OR s.id IS NULL OR s.role::text<>'seller'
 OR q.session_id IS DISTINCT FROM l.session_id OR q.buyer_name IS DISTINCT FROM l.name
 OR q.buyer_phone IS DISTINCT FROM l.phone OR q.province IS DISTINCT FROM l.province
 OR q.seller_id IS DISTINCT FROM l.assigned_to OR s.dealer_id IS DISTINCT FROM l.dealer_id
 OR c.config_snapshot->>'quote_id' IS DISTINCT FROM q.id::text
 OR q.model IS DISTINCT FROM c.config_snapshot->>'model' OR q.version IS DISTINCT FROM c.config_snapshot->>'version'
 OR q.color IS DISTINCT FROM c.config_snapshot->>'color'
 OR q.battery::text IS DISTINCT FROM c.config_snapshot->>'battery'
 OR q.accessories::text[] IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(c.config_snapshot::jsonb->'accessories'))
UNION ALL
SELECT 'quote_catalog_math',count(*) FROM public.quotes q
LEFT JOIN public.vehicle_prices v ON v.id::text=q.price_snapshot->>'vehicle_price_id'
WHERE v.id IS NULL OR (v.model,v.version,v.color) IS DISTINCT FROM (q.model,q.version,q.color)
 OR v.price_version IS DISTINCT FROM q.price_version OR v.price IS DISTINCT FROM (q.price_snapshot->>'base_price')::bigint
 OR q.final_price IS DISTINCT FROM (q.price_snapshot->>'final_price')::bigint
 OR q.final_price IS DISTINCT FROM ((q.price_snapshot->>'base_price')::bigint+(q.price_snapshot->>'battery_cost')::bigint
 +COALESCE((SELECT sum((x->>'price')::bigint) FROM jsonb_array_elements(q.price_snapshot::jsonb->'accessories') x),0)
 +COALESCE((SELECT sum(value::bigint) FROM jsonb_each_text(q.price_snapshot::jsonb->'rolling_costs')),0)
 -(q.price_snapshot->>'total_discount')::bigint)
UNION ALL
SELECT 'quote_timeline_state',count(*) FROM public.quotes q JOIN public.leads l ON l.id=q.lead_id
JOIN public.chat_sessions c ON c.session_id=q.session_id
WHERE q.created_at<l.created_at OR c.created_at>l.created_at OR c.updated_at<q.created_at OR l.updated_at<q.created_at
 OR q.status IS NULL
 OR (q.status::text IN ('approved','rejected') AND (q.reviewed_at IS NULL OR q.reviewed_at<q.created_at))
 OR (q.status::text IN ('pending','expired') AND q.reviewed_at IS NOT NULL)
 OR l.status::text IS DISTINCT FROM CASE q.status::text WHEN 'pending' THEN 'quoted' WHEN 'approved' THEN 'closed_won' ELSE 'closed_lost' END
UNION ALL
SELECT 'inventory_catalog_staff',count(*) FROM public.inventory i LEFT JOIN public.users w ON w.id=i.updated_by
WHERE w.id IS NULL OR w.role::text<>'warehouse' OR w.dealer_id IS DISTINCT FROM i.dealer_id OR i.quantity<0
 OR NOT EXISTS(SELECT 1 FROM public.vehicle_prices v WHERE (v.model,v.version,v.color)=(i.model,i.version,i.color) AND v.color_hex=i.color_hex)
UNION ALL
SELECT 'duplicate_lead_session',count(*) FROM (SELECT session_id FROM public.leads GROUP BY session_id HAVING count(*)>1) x
"""


async def snapshot(conn):
    data = {}
    for table in PROTECTED + BUSINESS:
        records = await conn.fetch(f"SELECT row_to_json(t)::text AS row FROM public.{table} t ORDER BY id")
        data[table] = [json.loads(r["row"]) for r in records]
    return data


async def operate(conn, mode, as_of, adopt=False, expected_plan_sha256=None):
    async with conn.transaction(isolation="repeatable_read", readonly=mode != "apply"):
        if mode == "check":
            return {"checks": [dict(r) for r in await conn.fetch(INTEGRITY_SQL)],
                    "row_counts": {t: await conn.fetchval(f"SELECT count(*) FROM public.{t}") for t in BUSINESS}}
        if mode == "apply":
            await conn.execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';")
            await conn.execute("SELECT pg_advisory_xact_lock(97004)")
            await conn.execute("LOCK TABLE " + ",".join("public." + t for t in PROTECTED + BUSINESS) + " IN SHARE ROW EXCLUSIVE MODE")
        data = await snapshot(conn)
        plan = build_plan(data, as_of, adopt)
        fingerprints = {t: await conn.fetchval(fingerprint_sql(t)) for t in PROTECTED + BUSINESS}
        plan_sha256 = digest({"rows": plan, "fingerprints": fingerprints})
        if expected_plan_sha256 and plan_sha256 != expected_plan_sha256:
            raise OperationError("Reviewed plan changed; no mock writes started. Run plan again and review the new report")
        result = {"mock_dataset": TAG, "as_of": as_of.isoformat(), "adopt_existing_mock": adopt,
                  "planned_rows": {t: len(r) for t, r in plan.items()},
                  "existing_rows": {t: len(data[t]) for t in BUSINESS},
                  "protected_fingerprints": {t: fingerprints[t] for t in PROTECTED}, "plan_sha256": plan_sha256}
        if mode == "apply":
            # Outer transaction owns commit; SQL guard/validation and writes stay atomic.
            sql = render_sql(plan, fingerprints).removeprefix("BEGIN;").removesuffix("COMMIT;")
            await conn.execute(sql)
            result["checks"] = [dict(r) for r in await conn.fetch(INTEGRITY_SQL)]
            # Existing users must remain byte-for-byte unchanged, including passwords.
            after = await snapshot(conn)
            current = {r["id"]: r for r in after["users"]}
            if any(current.get(r["id"]) != r for r in data["users"]):
                raise OperationError("Existing users changed; transaction will be rolled back")
            result["final_rows"] = {t: len(after[t]) for t in BUSINESS}
        return result


async def main(args):
    load_dotenv(ROOT / ".env", override=False)
    url = connection_url(os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL", ""))
    print(f"Mode: {args.mode}; target: {target_label(url)}")
    ssl = os.environ.get("MIGRATION_SSLMODE")
    if ssl is None and (urlsplit(url).hostname or "").endswith((".supabase.com", ".supabase.co")):
        ssl = "require"
    conn = await asyncpg.connect(url, timeout=15, command_timeout=60, statement_cache_size=0, **({"ssl": ssl} if ssl else {}))
    try:
        result = await operate(conn, args.mode, stamp(args.as_of), args.adopt_existing_mock, args.expected_plan_sha256)
        print(json.dumps(result, ensure_ascii=False, indent=2, default=serialize))
        return int(any(r["errors"] for r in result.get("checks", [])))
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("plan", "apply", "check"))
    parser.add_argument("--as-of", default=datetime.now(UTC).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0).isoformat(),
                        help="UTC reference timestamp; reuse the same value to reproduce the dataset")
    parser.add_argument("--adopt-existing-mock", action="store_true", help="Explicitly regenerate existing unmarked fake leads/quotes, retaining IDs")
    parser.add_argument("--expected-plan-sha256", help="Refuse apply if source/business data changed since the reviewed plan")
    try:
        sys.exit(asyncio.run(main(parser.parse_args())))
    except OperationError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except (TimeoutError, asyncpg.PostgresError, OSError, ValueError) as exc:
        print(f"Failed ({type(exc).__name__}); transaction rolled back or no writes started. Check target/schema/configuration.", file=sys.stderr)
        sys.exit(1)
