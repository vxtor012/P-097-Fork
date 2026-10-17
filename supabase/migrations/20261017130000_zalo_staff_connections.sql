-- Zalo-only changes. Existing customers, quotes and staff accounts stay intact.
-- Refuse an ambiguous conversion of legacy dealer contacts to staff ownership.
DO $guard$
BEGIN
  IF EXISTS (SELECT FROM public.zalo_contacts) THEN
    RAISE EXCEPTION 'Review existing Zalo contacts before assigning staff ownership';
  END IF;
END $guard$;

ALTER TABLE public.zalo_contacts
  ADD COLUMN user_id uuid NOT NULL REFERENCES public.users(id);
ALTER TABLE public.zalo_contacts DROP CONSTRAINT zalo_contacts_pkey;
ALTER TABLE public.zalo_contacts DROP CONSTRAINT zalo_contacts_dealer_id_zalo_uid_key;
ALTER TABLE public.zalo_contacts ADD PRIMARY KEY (user_id,lead_id);
ALTER TABLE public.zalo_contacts
  ADD CONSTRAINT zalo_contacts_user_dealer_recipient_key UNIQUE (user_id,dealer_id,zalo_uid);
CREATE INDEX ix_zalo_campaigns_owner ON public.zalo_campaigns(created_by,created_at DESC);
