-- Allow explicit admin role in users table.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS user_role_check;

ALTER TABLE users
    ADD CONSTRAINT user_role_check
    CHECK (user_role IN ('normal', 'staff', 'admin'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'package_event_status'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE package_event_status AS ENUM ('Active', 'Cancelled');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS package_events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_by INT NOT NULL REFERENCES users(id),
    status package_event_status NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS package_event_staff (
    event_id INT NOT NULL REFERENCES package_events(id) ON DELETE CASCADE,
    staff_id INT NOT NULL REFERENCES staff(staff_id),
    PRIMARY KEY (event_id, staff_id)
);

CREATE TABLE IF NOT EXISTS package_event_items (
    event_id INT NOT NULL REFERENCES package_events(id) ON DELETE CASCADE,
    resource_id INT NOT NULL REFERENCES resources(id),
    quantity_required INT NOT NULL CHECK (quantity_required > 0),
    PRIMARY KEY (event_id, resource_id)
);

CREATE TABLE IF NOT EXISTS package_event_attendees (
    event_id INT NOT NULL REFERENCES package_events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_package_events_start_status
    ON package_events(start_time, status);

CREATE INDEX IF NOT EXISTS idx_package_event_attendees_event
    ON package_event_attendees(event_id);
