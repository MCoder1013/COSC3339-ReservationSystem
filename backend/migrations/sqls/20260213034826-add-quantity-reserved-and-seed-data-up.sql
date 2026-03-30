-- quantity column
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS quantity_reserved INT NOT NULL DEFAULT 1;

-- reservation time check
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS chk_time_order;

ALTER TABLE reservations
ADD CONSTRAINT chk_time_order
CHECK (end_time > start_time);

-- quantity validation
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS chk_qty_reserved;

ALTER TABLE reservations
ADD CONSTRAINT chk_qty_reserved
CHECK (quantity_reserved > 0);

-- cabin validation
ALTER TABLE cabins
  ADD CONSTRAINT chk_cabin_capacity_positive
  CHECK (capacity > 0);

ALTER TABLE resources
ADD CONSTRAINT chk_resource_name_not_blank
CHECK (CHAR_LENGTH(TRIM(name)) > 0);

-- staff validation
ALTER TABLE staff
DROP CONSTRAINT IF EXISTS chk_staff_name_not_blank;

ALTER TABLE staff
ADD CONSTRAINT chk_staff_name_not_blank
CHECK (CHAR_LENGTH(TRIM(name)) > 0);

-- reservation must target something
ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS chk_reservation_target;

ALTER TABLE reservations
ADD CONSTRAINT chk_reservation_target
CHECK (
    cabin_id IS NOT NULL
    OR resource_id IS NOT NULL
    OR staff_id IS NOT NULL
);

-- default profile picture
ALTER TABLE users
ALTER COLUMN profile_picture
SET DEFAULT '/images/default_profile.png';
