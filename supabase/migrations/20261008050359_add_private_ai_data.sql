CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE SCHEMA ai_data;
REVOKE ALL ON SCHEMA ai_data FROM PUBLIC;
CREATE TABLE ai_data.datasets (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    content_sha256 text NOT NULL UNIQUE CHECK (length(content_sha256) = 64),
    created_at timestamptz NOT NULL DEFAULT now(),
    embedding_model text NOT NULL CHECK (embedding_model = 'text-embedding-3-small'),
    dimensions integer NOT NULL CHECK (dimensions = 1536),
    row_counts jsonb NOT NULL,
    manifest jsonb NOT NULL,
    web_sources jsonb,
    is_active boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX datasets_one_active ON ai_data.datasets (is_active) WHERE is_active;
CREATE TABLE ai_data.catalog_tables (
    dataset_id uuid NOT NULL REFERENCES ai_data.datasets(id),
    table_name text NOT NULL CHECK (table_name IN ('battery_rental_fees','cars_catalog','fee_rules','promotions','provinces','rolling_cost_matrix','trims_pricing','vehicle_colors')),
    rows jsonb NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
    row_count integer NOT NULL CHECK (row_count >= 0 AND row_count = jsonb_array_length(rows)),
    content_sha256 text NOT NULL CHECK (length(content_sha256) = 64),
    PRIMARY KEY (dataset_id, table_name)
);
CREATE TABLE ai_data.knowledge_records (
    dataset_id uuid NOT NULL REFERENCES ai_data.datasets(id),
    record_id text NOT NULL,
    record_type text NOT NULL,
    category text,
    title text,
    text text NOT NULL CHECK (length(text) > 0),
    url text,
    doc_id text,
    embedding extensions.vector(1536) NOT NULL,
    original_record jsonb NOT NULL,
    PRIMARY KEY (dataset_id, record_id)
);
CREATE INDEX knowledge_records_category ON ai_data.knowledge_records(dataset_id, category);
ALTER TABLE ai_data.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data.catalog_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data.knowledge_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ai_data FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai_data REVOKE ALL ON TABLES FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
        REVOKE ALL ON SCHEMA ai_data FROM anon;
        REVOKE ALL ON ALL TABLES IN SCHEMA ai_data FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
        REVOKE ALL ON SCHEMA ai_data FROM authenticated;
        REVOKE ALL ON ALL TABLES IN SCHEMA ai_data FROM authenticated;
    END IF;
END $$;
