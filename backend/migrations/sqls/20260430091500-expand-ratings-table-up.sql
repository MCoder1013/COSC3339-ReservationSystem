ALTER TABLE ratings
    ALTER COLUMN reservation_id DROP NOT NULL;

ALTER TABLE ratings
    ADD COLUMN IF NOT EXISTS package_event_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ratings_package_event_id_fkey'
    ) THEN
        ALTER TABLE ratings
            ADD CONSTRAINT ratings_package_event_id_fkey
            FOREIGN KEY (package_event_id)
            REFERENCES package_events(id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_package_event_id
    ON ratings(package_event_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ratings_target_check'
    ) THEN
        ALTER TABLE ratings
            ADD CONSTRAINT ratings_target_check
            CHECK (
                (
                    CASE WHEN reservation_id IS NOT NULL THEN 1 ELSE 0 END
                    + CASE WHEN package_event_id IS NOT NULL THEN 1 ELSE 0 END
                ) = 1
            );
    END IF;
END $$;