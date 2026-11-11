-- Banco exclusivo BN Lanches (Cloudflare D1).
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 request_key TEXT NOT NULL UNIQUE,
 tracking_token TEXT NOT NULL UNIQUE,
 recovery_hash TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 items_json TEXT NOT NULL,
 total_cents INTEGER NOT NULL CHECK(total_cents>0),
 payment_method TEXT NOT NULL CHECK(payment_method IN ('pix','cartao','dinheiro')),
 status TEXT NOT NULL DEFAULT 'novo' CHECK(status IN ('novo','aceito','pronto','retirado','cancelado')),
 paid INTEGER NOT NULL DEFAULT 0 CHECK(paid IN (0,1)),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 accepted_at INTEGER,
 ready_at INTEGER,
 delivered_at INTEGER,
 paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS orders_phone_created ON orders(phone,created_at);
CREATE INDEX IF NOT EXISTS orders_status_created ON orders(status,created_at);
CREATE TABLE IF NOT EXISTS login_attempts (
 key TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_key_created ON login_attempts(key,created_at);
