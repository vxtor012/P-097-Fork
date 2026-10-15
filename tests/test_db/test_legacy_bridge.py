"""Exercise the observed legacy schema using invented records on localhost only."""

import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2
import pytest
from langchain_core.messages import messages_from_dict


def test_bridge_preserves_legacy_rows_and_accepts_both_clients():
    url = os.environ.get("AI_TEST_DATABASE_URL")
    if not url:
        pytest.skip("AI_TEST_DATABASE_URL is not set")
    parsed = urlsplit(url)
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not parsed.path.endswith("_test"):
        pytest.fail("Bridge tests require an isolated localhost *_test database")
    connection = psycopg2.connect(url)
    try:
        with connection.cursor() as cur:
            # All DDL and invented data roll back, including when an assertion fails.
            cur.execute("SELECT count(*) FROM public.auth_sessions")
            assert cur.fetchone()[0] == 0
            cur.execute("""
              ALTER TABLE public.auth_sessions RENAME COLUMN id TO token_hash;
              ALTER TABLE public.auth_sessions ALTER COLUMN token_hash TYPE varchar(64) USING token_hash::text;
              ALTER TABLE public.auth_sessions ALTER COLUMN token_hash DROP DEFAULT;
              ALTER TABLE public.auth_sessions DROP COLUMN created_at;
              ALTER TABLE public.auth_sessions DROP COLUMN revoked_at;
              ALTER TABLE public.quote_requests RENAME COLUMN id TO key;
              ALTER TABLE public.quote_requests ADD COLUMN lead_id uuid NOT NULL REFERENCES public.leads(id);
              ALTER TABLE public.quote_requests ALTER COLUMN created_at SET DEFAULT now();
              ALTER TABLE public.newsletter_subscriptions DROP COLUMN id;
              ALTER TABLE public.newsletter_subscriptions ADD PRIMARY KEY(email);
              ALTER TABLE public.newsletter_subscriptions RENAME COLUMN consent_at TO created_at;
              ALTER TABLE public.newsletter_subscriptions ALTER COLUMN created_at SET DEFAULT now();
              ALTER TABLE public.branches DROP COLUMN is_active;
              ALTER TABLE public.stores DROP COLUMN is_active;
              ALTER TABLE public.stores DROP COLUMN address;
              DROP TABLE public.conversation_threads;
              DROP INDEX public.ux_inventory_configuration;
              DROP INDEX public.ux_inventory_store_configuration;
              CREATE UNIQUE INDEX ux_inventory_store_configuration ON public.inventory
                (dealer_id,store_id,model,version,color) NULLS NOT DISTINCT;
              CREATE TABLE public.business_chat_messages (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id varchar(100) NOT NULL,
                role varchar(20) NOT NULL, content text NOT NULL, created_at timestamp DEFAULT now()
              );
            """)
            user_id, lead_id, quote_id, key = [str(uuid.uuid4()) for _ in range(4)]
            cur.execute(
                "INSERT INTO public.users(id,email,name,hashed_pw) VALUES(%s,%s,'Synthetic bridge user','disabled')",
                (user_id, user_id + "@example.invalid"),
            )
            cur.execute("INSERT INTO public.leads(id,session_id) VALUES(%s,%s)", (lead_id, key))
            cur.execute(
                """INSERT INTO public.quotes(id,session_id,lead_id,price_snapshot,price_version,final_price)
                           VALUES(%s,%s,%s,'{}','synthetic-test',1)""",
                (quote_id, key, lead_id),
            )
            cur.execute(
                "INSERT INTO public.auth_sessions(token_hash,user_id,expires_at) VALUES(%s,%s,now()+interval '1 day')",
                ("a" * 64, user_id),
            )
            cur.execute(
                "INSERT INTO public.quote_requests(key,payload_hash,quote_id,lead_id) VALUES(%s,%s,%s,%s)",
                (key, "b" * 64, quote_id, lead_id),
            )
            cur.execute("INSERT INTO public.newsletter_subscriptions(email) VALUES('synthetic-bridge@example.invalid')")
            cur.execute(
                "INSERT INTO public.business_chat_messages(session_id,role,content) VALUES(%s,'user','Synthetic previous message')",
                (key,),
            )
            before = {}
            for table, columns in [
                ("auth_sessions", "token_hash,user_id,expires_at"),
                ("quote_requests", "key,payload_hash,quote_id,lead_id,created_at"),
                ("newsletter_subscriptions", "email,created_at"),
            ]:
                cur.execute("SELECT " + columns + " FROM public." + table)
                before[table] = cur.fetchall()
            sql = (
                Path(__file__).resolve().parents[2]
                / "supabase/migrations/20261015060000_bridge_legacy_business_workflows.sql"
            ).read_text(encoding="utf-8")
            cur.execute(sql)
            cur.execute(sql)  # Re-running the bridge must not duplicate existing rows/history.
            for table, columns in [
                ("auth_sessions", "token_hash,user_id,expires_at"),
                ("quote_requests", "key,payload_hash,quote_id,lead_id,created_at"),
                ("newsletter_subscriptions", "email,created_at"),
            ]:
                cur.execute("SELECT " + columns + " FROM public." + table)
                assert cur.fetchall() == before[table]
            cur.execute("SELECT messages FROM public.conversation_threads WHERE id=%s", (key,))
            assert messages_from_dict(cur.fetchone()[0])[0].content == "Synthetic previous message"
            new_session, new_request, new_quote = [str(uuid.uuid4()) for _ in range(3)]
            cur.execute(
                "INSERT INTO public.auth_sessions(id,user_id,expires_at) VALUES(%s,%s,now()+interval '1 day') RETURNING length(token_hash)",
                (new_session, user_id),
            )
            assert cur.fetchone()[0] == 64
            cur.execute(
                """INSERT INTO public.quotes(id,session_id,lead_id,price_snapshot,price_version,final_price)
                           VALUES(%s,%s,%s,'{}','synthetic-test',1)""",
                (new_quote, key, lead_id),
            )
            cur.execute(
                "INSERT INTO public.quote_requests(id,payload_hash,quote_id) VALUES(%s,%s,%s) RETURNING key,lead_id",
                (new_request, "c" * 64, new_quote),
            )
            assert tuple(map(str, cur.fetchone())) == (new_request, lead_id)
            old_quote, old_request = str(uuid.uuid4()), str(uuid.uuid4())
            cur.execute(
                """INSERT INTO public.quotes(id,session_id,lead_id,price_snapshot,price_version,final_price)
                           VALUES(%s,%s,%s,'{}','synthetic-test',1)""",
                (old_quote, key, lead_id),
            )
            cur.execute(
                "INSERT INTO public.quote_requests(key,payload_hash,quote_id,lead_id) VALUES(%s,%s,%s,%s) RETURNING id",
                (old_request, "d" * 64, old_quote, lead_id),
            )
            assert str(cur.fetchone()[0]) == old_request
            cur.execute(
                "INSERT INTO public.newsletter_subscriptions(id,email,consent_at) VALUES(%s,'synthetic-new@example.invalid',now()) RETURNING created_at",
                (str(uuid.uuid4()),),
            )
            assert cur.fetchone()[0] is not None
    finally:
        connection.rollback()
        connection.close()
