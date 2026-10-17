-- Existing threads stay orphaned: never infer ownership from a public UUID.
ALTER TABLE public.conversation_threads ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id);
ALTER TABLE public.conversation_threads ADD COLUMN IF NOT EXISTS guest_secret_hash varchar(64);
CREATE INDEX IF NOT EXISTS conversation_threads_user_id_idx ON public.conversation_threads(user_id);

CREATE TABLE IF NOT EXISTS public.pricing_policies (
    id varchar(100) PRIMARY KEY,
    version varchar(100) NOT NULL,
    effective_from timestamp NOT NULL,
    effective_to timestamp,
    rules json NOT NULL,
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);
INSERT INTO public.pricing_policies (id, version, effective_from, rules)
VALUES ('battery-rental-2025', 'rental-legacy-2025-03-01', '2025-03-01',
    '{"new_rental_allowed":false,"rental_message":"Chính sách thuê pin mới đã dừng từ 01/03/2025. Chỉ áp dụng cho khách hàng đang thuê pin cũ, cần tư vấn viên xác minh hợp đồng."}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.eligibility_verifications (
    id uuid PRIMARY KEY,
    session_id varchar(100) NOT NULL REFERENCES public.conversation_threads(id),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id),
    attribute varchar(100) NOT NULL CHECK (attribute IN ('vinclub_tier','customer_group','purchase_channel','legacy_battery_rental')),
    value varchar(255) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','revoked')),
    evidence_ref varchar(500),
    verified_by uuid REFERENCES public.users(id),
    verified_at timestamp,
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    events json NOT NULL DEFAULT '[]',
    CHECK (status <> 'verified' OR (
        verified_by IS NOT NULL AND verified_at IS NOT NULL
        AND evidence_ref IS NOT NULL AND length(evidence_ref) > 0
    ))
);
CREATE INDEX IF NOT EXISTS eligibility_verifications_session_idx ON public.eligibility_verifications(session_id);
CREATE INDEX IF NOT EXISTS eligibility_verifications_dealer_idx ON public.eligibility_verifications(dealer_id);
CREATE INDEX IF NOT EXISTS eligibility_verifications_verified_by_idx ON public.eligibility_verifications(verified_by);
CREATE UNIQUE INDEX IF NOT EXISTS eligibility_verified_attribute_idx
ON public.eligibility_verifications(session_id, dealer_id, attribute) WHERE status = 'verified';
ALTER TABLE public.pricing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pricing_policies, public.eligibility_verifications FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.pricing_policies, public.eligibility_verifications FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.pricing_policies, public.eligibility_verifications FROM authenticated;
    END IF;
END
$$;
-- Revocation only changes future calculations. Quote JSON snapshots are never updated here.
