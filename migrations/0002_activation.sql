ALTER TABLE qr_codes ADD COLUMN activation_hash TEXT;
ALTER TABLE qr_codes ADD COLUMN activation_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE qr_codes ADD COLUMN activation_locked_until INTEGER NOT NULL DEFAULT 0;
