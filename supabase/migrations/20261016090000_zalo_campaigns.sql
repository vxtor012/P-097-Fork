-- No seed data and no browser access. Backend applies dealer authorization.
CREATE TABLE public.zalo_contacts (
    lead_id uuid PRIMARY KEY REFERENCES public.leads(id),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id),
    zalo_uid varchar(100) NOT NULL,
    account_uid varchar(100) NOT NULL,
    consent_at timestamp,
    consent_note varchar(500) NOT NULL DEFAULT '',
    opted_out boolean NOT NULL DEFAULT false,
    updated_by uuid NOT NULL REFERENCES public.users(id),
    updated_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    UNIQUE (dealer_id, zalo_uid)
);
CREATE TABLE public.zalo_campaigns (
    id uuid PRIMARY KEY,
    dealer_id uuid NOT NULL REFERENCES public.dealers(id),
    created_by uuid NOT NULL REFERENCES public.users(id),
    name varchar(200) NOT NULL,
    template text NOT NULL,
    account_uid varchar(100) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','done','cancelled')),
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE TABLE public.zalo_deliveries (
    id uuid PRIMARY KEY,
    campaign_id uuid NOT NULL REFERENCES public.zalo_campaigns(id),
    lead_id uuid NOT NULL REFERENCES public.leads(id),
    quote_id uuid NOT NULL REFERENCES public.quotes(id),
    zalo_uid varchar(100) NOT NULL,
    message text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','unknown','skipped')),
    error varchar(500),
    provider_id varchar(200),
    updated_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    UNIQUE (campaign_id, zalo_uid)
);
CREATE INDEX ix_zalo_deliveries_queue ON public.zalo_deliveries(status, campaign_id);
CREATE INDEX ix_zalo_campaigns_dealer ON public.zalo_campaigns(dealer_id, created_at DESC);
DO $security$
DECLARE t text; r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['zalo_contacts','zalo_campaigns','zalo_deliveries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
      END IF;
    END LOOP;
  END LOOP;
END $security$;
