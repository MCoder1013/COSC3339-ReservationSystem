ALTER TABLE package_events
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id INT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS cancelled_by_role VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE package_events
    DROP CONSTRAINT IF EXISTS package_events_cancelled_by_role_check;

ALTER TABLE package_events
    ADD CONSTRAINT package_events_cancelled_by_role_check
    CHECK (
        cancelled_by_role IS NULL
        OR cancelled_by_role IN ('staff', 'admin')
    );
