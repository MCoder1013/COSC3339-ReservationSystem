-- Remove constraints (in reverse order of UP migration)
ALTER TABLE staff DROP CONSTRAINT chk_staff_name_not_blank;
ALTER TABLE cabins DROP CONSTRAINT chk_cabin_number_not_blank;
ALTER TABLE resources DROP CONSTRAINT chk_resource_name_not_blank;
ALTER TABLE cabins DROP CONSTRAINT chk_cabin_capacity_positive;

ALTER TABLE reservations DROP CONSTRAINT chk_qty_reserved;
ALTER TABLE reservations DROP CONSTRAINT chk_time_order;

-- Remove column
ALTER TABLE reservations DROP COLUMN quantity_reserved;

