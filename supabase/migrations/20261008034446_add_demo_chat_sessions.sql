-- Existing Supabase projects may already have this table; preserve all rows.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    messages JSON,
    config_snapshot JSON,
    ai_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_sessions FROM PUBLIC;
DO $roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.chat_sessions FROM %I', role_name);
    END IF;
  END LOOP;
END $roles$;
