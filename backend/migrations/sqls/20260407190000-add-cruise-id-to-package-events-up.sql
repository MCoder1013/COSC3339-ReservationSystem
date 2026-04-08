ALTER TABLE package_events
    ADD COLUMN IF NOT EXISTS cruise_id INT;

ALTER TABLE package_events
    DROP CONSTRAINT IF EXISTS fk_package_events_cruise;

ALTER TABLE package_events
    ADD CONSTRAINT fk_package_events_cruise
        FOREIGN KEY (cruise_id) REFERENCES cruises(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_package_events_cruise_status_start
    ON package_events (cruise_id, status, start_time);
