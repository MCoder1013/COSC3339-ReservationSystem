/* Replace with your SQL commands */

-- Add quantity_reserved column
-- Add constraints from sprint2_migration.sql
ALTER TABLE reservations
  ADD CONSTRAINT chk_time_order CHECK (end_time > start_time);

ALTER TABLE reservations
  ADD CONSTRAINT chk_qty_reserved CHECK (quantity_reserved > 0);

-- Add other constraints
ALTER TABLE cabins
  ADD CONSTRAINT chk_cabin_capacity_positive CHECK (capacity > 0);

ALTER TABLE resources
  ADD CONSTRAINT chk_resource_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0);

ALTER TABLE cabins
  ADD CONSTRAINT chk_cabin_number_not_blank CHECK (CHAR_LENGTH(TRIM(cabin_number)) > 0);

ALTER TABLE staff
  ADD CONSTRAINT chk_staff_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0);