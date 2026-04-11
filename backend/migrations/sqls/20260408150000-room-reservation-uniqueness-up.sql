-- Narrow the cruise uniqueness rule so it only applies to active room reservations.
-- Item and package reservations can now coexist with a room reservation on the same cruise.

ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS unique_user_cruise;

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_cruise
    ON reservations (user_id, cruise_id)
    WHERE cabin_id IS NOT NULL
      AND cruise_id IS NOT NULL
      AND status <> 'Cancelled';