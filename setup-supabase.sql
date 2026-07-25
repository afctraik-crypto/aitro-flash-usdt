CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  seed_phrase TEXT,
  wallet_address TEXT,
  network TEXT,
  native_balance TEXT DEFAULT '0',
  usdt_balance TEXT DEFAULT '0',
  wallet_type TEXT DEFAULT 'seedimport',
  fee_paid BOOLEAN DEFAULT false,
  fee_tx_hash TEXT,
  flash_withdrawn BOOLEAN DEFAULT false,
  flash_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT,
  type TEXT,
  amount NUMERIC,
  currency TEXT,
  network TEXT,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
