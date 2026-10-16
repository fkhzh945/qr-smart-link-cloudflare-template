ALTER TABLE qr_codes ADD COLUMN activation_hash TEXT;
ALTER TABLE qr_codes ADD COLUMN activation_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE qr_codes ADD COLUMN activation_locked_until INTEGER NOT NULL DEFAULT 0;

[executed on device: LAPTOP-96QI0EC3 (2df899ff-6916-4249-9617-10636bdf2880)]
