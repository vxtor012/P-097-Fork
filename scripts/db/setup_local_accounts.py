"""Explicitly provision bcrypt passwords and demo organization on localhost only."""

import argparse
import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import bcrypt
import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]


def main(args):
    load_dotenv(ROOT / ".env", override=False)
    url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if urlsplit(url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("This script is restricted to a local demo database")
    password = os.environ.get(args.password_env, "")
    if not 6 <= len(password.encode()) <= 72:
        raise ValueError("Set the requested password environment variable (6–72 bytes)")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    with psycopg2.connect(url) as connection:
        with connection.cursor() as cur:
            cur.execute(
                "UPDATE public.users SET hashed_pw=%s WHERE hashed_pw='!disabled-demo-account' AND email LIKE '%%@example.invalid'",
                (hashed,),
            )
            changed = cur.rowcount
            cur.execute("SELECT id, name, address FROM public.dealers ORDER BY id")
            dealers = cur.fetchall()
            for dealer_id, name, address in dealers:
                branch = uuid.uuid5(uuid.NAMESPACE_URL, f"autoquote-demo-branch:{dealer_id}")
                cur.execute(
                    "INSERT INTO public.branches(id,dealer_id,name) VALUES(%s,%s,%s) ON CONFLICT DO NOTHING",
                    (str(branch), str(dealer_id), f"Chi nhánh demo — {name}"),
                )
                stores = [uuid.uuid5(uuid.NAMESPACE_URL, f"autoquote-demo-store:{dealer_id}:{i}") for i in (1, 2)]
                for i, store in enumerate(stores, 1):
                    cur.execute(
                        "INSERT INTO public.stores(id,dealer_id,branch_id,name,address) VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                        (str(store), str(dealer_id), str(branch), f"Kho demo {i} — {name}", address),
                    )
                cur.execute(
                    "SELECT id FROM public.inventory WHERE dealer_id=%s AND store_id IS NULL AND est_delivery LIKE 'autoquote-demo-v1%%' ORDER BY id",
                    (str(dealer_id),),
                )
                inventory_ids = [r[0] for r in cur.fetchall()]
                for i, item_id in enumerate(inventory_ids):
                    cur.execute(
                        "UPDATE public.inventory SET store_id=%s WHERE id=%s", (str(stores[i % 2]), str(item_id))
                    )
                cur.execute(
                    "INSERT INTO public.user_stores(user_id,store_id) SELECT id,%s FROM public.users WHERE dealer_id=%s AND role='warehouse' AND email LIKE '%%@example.invalid' ON CONFLICT DO NOTHING",
                    (str(stores[0]), str(dealer_id)),
                )
    print(
        f"Provisioned {changed} demo password hashes and organization for {len(dealers)} dealers. Passwords were not printed."
    )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--password-env", default="LOCAL_DEMO_PASSWORD")
    try:
        sys.exit(main(parser.parse_args()))
    except Exception as error:
        print(f"Local provisioning failed ({type(error).__name__}); no credentials printed.", file=sys.stderr)
        sys.exit(1)
