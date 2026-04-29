ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS cancelled_by_user_id INT REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(20),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE reservations
ADD CONSTRAINT chk_cancelled_by_role
CHECK (cancelled_by_role IN ('user', 'staff', 'admin'));