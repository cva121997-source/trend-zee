-- Trend-Zee guest identity OTP
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  target TEXT NOT NULL,
  channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_target_created ON otp_challenges(target,created_at);
CREATE INDEX IF NOT EXISTS otp_anon_created ON otp_challenges(anonymous_id,created_at);
