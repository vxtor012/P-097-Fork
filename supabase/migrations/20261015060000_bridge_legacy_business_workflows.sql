-- Both supported baseline branches converge here. No existing row is removed.
ALTER TYPE public.userrole ADD VALUE IF NOT EXISTS 'warehouse_manager';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Preserve token_hash and its primary key for the older deployed backend.
DO $migration$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='auth_sessions' AND column_name='token_hash') THEN
    ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
    ALTER TABLE public.auth_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamp;
    ALTER TABLE public.auth_sessions ALTER COLUMN token_hash SET DEFAULT (md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text));
    CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_sessions_id ON public.auth_sessions(id);
  END IF;
END $migration$;

-- Synchronize the old `key` and new `id` without renaming or dropping either.
DO $migration$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='quote_requests' AND column_name='key') THEN
    ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS id uuid;
    UPDATE public.quote_requests SET id=key WHERE id IS NULL;
    ALTER TABLE public.quote_requests ALTER COLUMN id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_quote_requests_id ON public.quote_requests(id);
    CREATE OR REPLACE FUNCTION public.bridge_quote_request_keys() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $function$
    BEGIN
      IF NEW.id IS NULL THEN NEW.id := NEW.key; END IF;
      IF NEW.key IS NULL THEN NEW.key := NEW.id; END IF;
      IF NEW.id IS DISTINCT FROM NEW.key THEN
        RAISE EXCEPTION 'Quote request identifiers must match';
      END IF;
      IF NEW.lead_id IS NULL THEN
        SELECT lead_id INTO NEW.lead_id FROM public.quotes WHERE id=NEW.quote_id;
      END IF;
      RETURN NEW;
    END $function$;
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid='public.quote_requests'::regclass AND tgname='bridge_quote_request_keys') THEN
      CREATE TRIGGER bridge_quote_request_keys BEFORE INSERT OR UPDATE ON public.quote_requests
        FOR EACH ROW EXECUTE FUNCTION public.bridge_quote_request_keys();
    END IF;
  END IF;
END $migration$;

DO $migration$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscriptions' AND column_name='created_at') THEN
    ALTER TABLE public.newsletter_subscriptions ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE public.newsletter_subscriptions ADD COLUMN IF NOT EXISTS consent_at timestamp;
    UPDATE public.newsletter_subscriptions SET consent_at=created_at WHERE consent_at IS NULL;
    ALTER TABLE public.newsletter_subscriptions ALTER COLUMN consent_at SET DEFAULT now();
    ALTER TABLE public.newsletter_subscriptions ALTER COLUMN consent_at SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_newsletter_subscriptions_id ON public.newsletter_subscriptions(id);
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id varchar(100) PRIMARY KEY,
  messages json NOT NULL DEFAULT '[]',
  profile json NOT NULL DEFAULT '{}',
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_threads FROM PUBLIC;
DO $migration$ BEGIN
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.conversation_threads FROM anon; END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.conversation_threads FROM authenticated; END IF;
  IF to_regclass('public.business_chat_messages') IS NOT NULL THEN
    INSERT INTO public.conversation_threads(id,messages,profile,updated_at)
    SELECT session_id,
      json_agg(json_build_object('type',CASE role WHEN 'user' THEN 'human' ELSE 'ai' END,
        'data',json_build_object('content',content,'type',CASE role WHEN 'user' THEN 'human' ELSE 'ai' END,
          'additional_kwargs','{}'::json,'response_metadata','{}'::json)) ORDER BY created_at,id),
      '{}'::json,max(created_at)
    FROM public.business_chat_messages
    WHERE role IN ('user','assistant') AND length(session_id)<=100
    GROUP BY session_id ON CONFLICT (id) DO NOTHING;
  END IF;
END $migration$;

-- Retain the existing NULLS NOT DISTINCT store index and add the baseline index.
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_configuration
  ON public.inventory(dealer_id,model,version,color) WHERE store_id IS NULL;
