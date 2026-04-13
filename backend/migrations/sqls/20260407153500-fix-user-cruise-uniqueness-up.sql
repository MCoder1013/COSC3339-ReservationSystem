-- Remove overly broad uniqueness that blocked item/event reservations
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS unique_user_cruise;

-- Keep one active room reservation per cruise for each user.
-- Item/event reservations remain unrestricted by this index.
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_cruise_room
ON reservations (user_id, cruise_id)
WHERE cabin_id IS NOT NULL AND status <> 'Cancelled';
