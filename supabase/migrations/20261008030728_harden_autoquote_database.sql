-- Additive upgrade: preserve all business data and price snapshots.
-- Run as the table owner, inside a transaction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.vehicle_prices
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS roof_hex VARCHAR(7);

-- One current price per configuration; protects scalar_one_or_none() in pricing.
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicle_prices_current_configuration
  ON public.vehicle_prices (model, version, color) WHERE effective_to IS NULL;

-- Prefix covers inventory_dealer_id_fkey and enforces the seed's natural key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_configuration
  ON public.inventory (dealer_id, model, version, color);
CREATE INDEX IF NOT EXISTS ix_inventory_updated_by ON public.inventory (updated_by);
CREATE INDEX IF NOT EXISTS ix_users_dealer_id ON public.users (dealer_id);
CREATE INDEX IF NOT EXISTS ix_leads_dealer_created
  ON public.leads (dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_leads_assigned_to ON public.leads (assigned_to);
CREATE INDEX IF NOT EXISTS ix_promotions_dealer_id ON public.promotions (dealer_id);
CREATE INDEX IF NOT EXISTS ix_promotions_created_by ON public.promotions (created_by);
CREATE INDEX IF NOT EXISTS ix_quotes_lead_id ON public.quotes (lead_id);
CREATE INDEX IF NOT EXISTS ix_quotes_seller_id ON public.quotes (seller_id);
CREATE INDEX IF NOT EXISTS ix_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_quotes_created_at ON public.quotes (created_at DESC);

-- Current frontend uses FastAPI, not direct Supabase table access.
-- No public policies: owner/backend continues working; browser roles cannot access.
DO $hardening$
DECLARE
  table_name TEXT;
  role_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'dealers','users','vehicle_prices','battery_prices','accessories',
    'rolling_costs','promotions','leads','quotes','inventory','chat_sessions'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
      FOREACH role_name IN ARRAY ARRAY['anon','authenticated']
      LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
                         table_name, role_name);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END
$hardening$;
