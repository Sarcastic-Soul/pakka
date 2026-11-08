-- Pakka schema. Idempotent: safe to run many times.

CREATE TABLE IF NOT EXISTS shops (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  pin_hash text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  shop_id integer NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_name_idx ON customers (shop_id, lower(name));

CREATE TABLE IF NOT EXISTS entries (
  id serial PRIMARY KEY,
  shop_id integer NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('udhaar', 'jama')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_rupees integer NOT NULL CHECK (total_rupees >= 0),
  transcript_raw text NOT NULL DEFAULT '',
  transcript_clean text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entries_shop_customer_idx ON entries (shop_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shops_demo_created_idx ON shops (created_at) WHERE is_demo;

CREATE TABLE IF NOT EXISTS usage (
  day date NOT NULL,
  kind text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
