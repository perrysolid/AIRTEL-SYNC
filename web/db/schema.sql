-- Udyam Digital store on Neon Postgres. Idempotent: applied at boot by src/lib/db.ts.
-- Sessions, orders and consents are JSON documents keyed by id; seq keeps
-- insertion order (the consent ledger is a hash chain, so order matters).
CREATE TABLE IF NOT EXISTS records (
  kind       text        NOT NULL,
  id         text        NOT NULL,
  seq        bigserial,
  data       jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS records_kind_seq ON records (kind, seq);
-- Customer accounts (phone sign-in) were added later; widen the kind check on existing tables.
ALTER TABLE records DROP CONSTRAINT IF EXISTS records_kind_check;
ALTER TABLE records ADD CONSTRAINT records_kind_check CHECK (kind IN ('session', 'order', 'consent', 'customer'));

-- Append-only audit trail (identifiers already masked by the caller).
CREATE TABLE IF NOT EXISTS audit_log (
  id     bigserial   PRIMARY KEY,
  at     timestamptz NOT NULL,
  actor  text        NOT NULL,
  action text        NOT NULL,
  ref    text        NOT NULL,
  detail text        NOT NULL DEFAULT ''
);

-- Sales portal: staff accounts (salespeople, channel partners, managers).
CREATE TABLE IF NOT EXISTS staff (
  id            text        PRIMARY KEY,
  email         text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('admin', 'sales', 'partner')),
  region        text,
  partner_code  text,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Every touch on a lead: calls, WhatsApp links sent, notes, status changes, reassignments.
CREATE TABLE IF NOT EXISTS lead_activity (
  id        bigserial   PRIMARY KEY,
  lead_id   text        NOT NULL,
  staff_id  text        NOT NULL,
  at        timestamptz NOT NULL DEFAULT now(),
  kind      text        NOT NULL CHECK (kind IN ('call', 'whatsapp', 'note', 'status', 'assign')),
  outcome   text,
  status    text,
  note      text        NOT NULL DEFAULT '',
  next_at   timestamptz
);
CREATE INDEX IF NOT EXISTS lead_activity_lead ON lead_activity (lead_id, at);
CREATE INDEX IF NOT EXISTS lead_activity_staff ON lead_activity (staff_id, at);

-- WhatsApp linked-device login (keys for the number the bot runs on), so a restart doesn't need relinking.
CREATE TABLE IF NOT EXISTS wa_auth (
  key   text PRIMARY KEY,
  value text NOT NULL
);
