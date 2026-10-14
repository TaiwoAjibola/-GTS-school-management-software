-- Student self-service password reset support
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(24);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ;
