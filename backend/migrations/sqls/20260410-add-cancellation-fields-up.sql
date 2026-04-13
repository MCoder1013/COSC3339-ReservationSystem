ALTER TABLE reservations
ADD COLUMN cancelled_by_user_id INT REFERENCES users(id),
ADD COLUMN cancelled_by_role VARCHAR(20),
ADD COLUMN cancellation_reason TEXT,
ADD COLUMN cancelled_at TIMESTAMPTZ;

ALTER TABLE reservations
ADD CONSTRAINT chk_cancelled_by_role
CHECK (cancelled_by_role IN ('user', 'staff', 'admin'));