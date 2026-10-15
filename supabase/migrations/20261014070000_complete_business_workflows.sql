-- Additive migration. Existing inventory remains dealer-level (store_id NULL).
ALTER TYPE public.userrole ADD VALUE IF NOT EXISTS 'warehouse_manager';

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  name varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(id, dealer_id)
);
CREATE INDEX ix_branches_dealer_id ON public.branches(dealer_id);
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  name varchar(255) NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(id, dealer_id),
  FOREIGN KEY(branch_id, dealer_id) REFERENCES public.branches(id, dealer_id)
);
CREATE INDEX ix_stores_dealer_id ON public.stores(dealer_id);
CREATE INDEX ix_stores_branch_id ON public.stores(branch_id);
CREATE INDEX ix_stores_branch_dealer ON public.stores(branch_id, dealer_id);
CREATE TABLE public.user_stores (
  user_id uuid NOT NULL REFERENCES public.users(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  PRIMARY KEY(user_id, store_id)
);
CREATE INDEX ix_user_stores_store_id ON public.user_stores(store_id);
ALTER TABLE public.inventory ADD COLUMN store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_store_dealer_fk
  FOREIGN KEY(store_id, dealer_id) REFERENCES public.stores(id, dealer_id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_quantity_nonnegative CHECK(quantity >= 0);
CREATE INDEX ix_inventory_store_id ON public.inventory(store_id);
CREATE INDEX ix_inventory_store_dealer ON public.inventory(store_id, dealer_id);
CREATE INDEX ix_inventory_dealer_id ON public.inventory(dealer_id);
DO $$ BEGIN
  IF EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.inventory'::regclass AND conname='ux_inventory_configuration') THEN
    ALTER TABLE public.inventory DROP CONSTRAINT ux_inventory_configuration;
  ELSE
    DROP INDEX public.ux_inventory_configuration;
  END IF;
END $$;
CREATE UNIQUE INDEX ux_inventory_configuration ON public.inventory(dealer_id, model, version, color) WHERE store_id IS NULL;
CREATE UNIQUE INDEX ux_inventory_store_configuration ON public.inventory(store_id, model, version, color) WHERE store_id IS NOT NULL;

CREATE TABLE public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_sessions_user_id ON public.auth_sessions(user_id);
CREATE INDEX ix_auth_sessions_expires_at ON public.auth_sessions(expires_at);
CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY,
  payload_hash varchar(64) NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX ix_quote_requests_quote_id ON public.quote_requests(quote_id);
CREATE TABLE public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL UNIQUE,
  consent_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_threads (
  id varchar(100) PRIMARY KEY,
  messages json NOT NULL DEFAULT '[]',
  profile json NOT NULL DEFAULT '{}',
  updated_at timestamp NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['branches','stores','user_stores','auth_sessions','quote_requests','newsletter_subscriptions','conversation_threads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
