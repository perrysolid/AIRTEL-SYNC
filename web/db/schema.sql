-- Udyam Digital store on Neon Postgres. Idempotent: applied at boot by src/lib/db.ts.
-- Sessions, orders and consents are JSON documents keyed by id; seq keeps
-- insertion order (the consent ledger is a hash chain, so order matters).
CREATE TABLE IF NOT EXISTS records (
  kind       text        NOT NULL CHECK (kind IN ('session', 'order', 'consent')),
  id         text        NOT NULL,
  seq        bigserial,
  data       jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS records_kind_seq ON records (kind, seq);

-- Append-only audit trail (identifiers already masked by the caller).
CREATE TABLE IF NOT EXISTS audit_log (
  id     bigserial   PRIMARY KEY,
  at     timestamptz NOT NULL,
  actor  text        NOT NULL,
  action text        NOT NULL,
  ref    text        NOT NULL,
  detail text        NOT NULL DEFAULT ''
);
