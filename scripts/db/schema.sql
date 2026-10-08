-- Fresh-database baseline only; upgrades use supabase/migrations.

CREATE TYPE userrole      AS ENUM ('buyer','seller','warehouse','admin');
CREATE TYPE quotestatus   AS ENUM ('pending','approved','rejected','expired');
CREATE TYPE discounttype  AS ENUM ('fixed','percent');
CREATE TYPE batteryoption AS ENUM ('buy','rent');
CREATE TYPE leadstatus    AS ENUM ('new','contacted','quoted','closed_won','closed_lost');

CREATE TABLE dealers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    province   VARCHAR(100) NOT NULL,
    address    TEXT,
    phone      VARCHAR(20),
    lat        FLOAT,
    lng        FLOAT,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255) NOT NULL,
    hashed_pw  VARCHAR(255) NOT NULL,
    role       userrole DEFAULT 'buyer',
    dealer_id  UUID REFERENCES dealers(id) ON DELETE SET NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vehicle_prices (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model          VARCHAR(50)  NOT NULL,
    version        VARCHAR(100) NOT NULL,
    color          VARCHAR(100) NOT NULL,
    color_hex      VARCHAR(7)   NOT NULL,
    price          BIGINT       NOT NULL,
    price_version  VARCHAR(50)  NOT NULL,
    effective_from TIMESTAMP    NOT NULL,
    effective_to   TIMESTAMP,
    image_url      VARCHAR(500),
    roof_hex       VARCHAR(7),
    created_at     TIMESTAMP DEFAULT NOW()
);


CREATE TABLE battery_prices (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model      VARCHAR(50) NOT NULL UNIQUE,
    buy_price  BIGINT NOT NULL,
    rent_price BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accessories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(50) UNIQUE NOT NULL,
    name              VARCHAR(255) NOT NULL,
    price             BIGINT NOT NULL,
    compatible_models TEXT[] DEFAULT '{}',
    is_active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE rolling_costs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    province          VARCHAR(100) NOT NULL UNIQUE,
    registration_rate FLOAT  NOT NULL,
    road_fee          BIGINT NOT NULL,
    inspection_fee    BIGINT NOT NULL,
    insurance_rate    FLOAT  NOT NULL,
    plate_fee         BIGINT NOT NULL,
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE promotions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    model          VARCHAR(50) DEFAULT 'ALL',
    province       VARCHAR(100),
    dealer_id      UUID REFERENCES dealers(id) ON DELETE SET NULL,
    discount_type  discounttype NOT NULL,
    discount_value BIGINT NOT NULL,
    start_date     TIMESTAMP NOT NULL,
    end_date       TIMESTAMP NOT NULL,
    conditions     JSONB DEFAULT '{}',
    is_active      BOOLEAN DEFAULT TRUE,
    usage_count    INT DEFAULT 0,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE leads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    VARCHAR(100) NOT NULL,
    name          VARCHAR(255),
    phone         VARCHAR(20),
    province      VARCHAR(100),
    interested_in VARCHAR(255),
    budget        BIGINT,
    note          TEXT,
    status        leadstatus DEFAULT 'new',
    dealer_id     UUID REFERENCES dealers(id),
    assigned_to   UUID REFERENCES users(id),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     VARCHAR(100) NOT NULL,
    lead_id        UUID REFERENCES leads(id),
    buyer_name     VARCHAR(255),
    buyer_phone    VARCHAR(20),
    model          VARCHAR(50),
    version        VARCHAR(100),
    color          VARCHAR(100),
    battery        batteryoption,
    province       VARCHAR(100),
    accessories    TEXT[] DEFAULT '{}',
    price_snapshot JSONB NOT NULL,
    price_version  VARCHAR(50) NOT NULL,
    final_price    BIGINT NOT NULL,
    status         quotestatus DEFAULT 'pending',
    seller_id      UUID REFERENCES users(id),
    seller_note    TEXT,
    pdf_url        VARCHAR(500),
    created_at     TIMESTAMP DEFAULT NOW(),
    reviewed_at    TIMESTAMP,
    expires_at     TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE inventory (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id    UUID NOT NULL REFERENCES dealers(id),
    model        VARCHAR(50)  NOT NULL,
    version      VARCHAR(100) NOT NULL,
    color        VARCHAR(100) NOT NULL,
    color_hex    VARCHAR(7),
    quantity     INT DEFAULT 0,
    est_delivery VARCHAR(100),
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT ux_inventory_configuration UNIQUE(dealer_id, model, version, color)
);

-- Baseline indexes and backend-only table access.
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

CREATE INDEX IF NOT EXISTS ix_dealers_province ON public.dealers (province);
CREATE INDEX IF NOT EXISTS ix_vehicle_prices_model ON public.vehicle_prices (model);
CREATE INDEX IF NOT EXISTS ix_vehicle_prices_price_version ON public.vehicle_prices (price_version);
CREATE INDEX IF NOT EXISTS ix_inventory_model ON public.inventory (model);
CREATE INDEX IF NOT EXISTS ix_leads_session_id ON public.leads (session_id);
CREATE INDEX IF NOT EXISTS ix_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS ix_quotes_session_id ON public.quotes (session_id);
CREATE INDEX IF NOT EXISTS ix_quotes_status ON public.quotes (status);
CREATE INDEX IF NOT EXISTS ix_promotions_model ON public.promotions (model);
CREATE INDEX IF NOT EXISTS ix_promotions_start_date ON public.promotions (start_date);
CREATE INDEX IF NOT EXISTS ix_promotions_end_date ON public.promotions (end_date);
CREATE INDEX IF NOT EXISTS ix_promotions_is_active ON public.promotions (is_active);
