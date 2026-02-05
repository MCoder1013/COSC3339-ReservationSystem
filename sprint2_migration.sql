USE cruise_reservation;

-- 1) Reservations: core validation
ALTER TABLE reservations
  ADD CONSTRAINT chk_time_order CHECK (end_time > start_time);

ALTER TABLE reservations
  ADD CONSTRAINT chk_exactly_one_target CHECK (
    (cabin_id IS NOT NULL) + (resource_id IS NOT NULL) + (staff_id IS NOT NULL) = 1
  );

ALTER TABLE reservations
  ADD CONSTRAINT chk_qty_reserved CHECK (quantity_reserved > 0);

-- 2) Inventory: prevent negatives + blank names

ALTER TABLE cabins
  ADD CONSTRAINT chk_cabin_capacity_positive CHECK (capacity > 0);

ALTER TABLE resources
  ADD CONSTRAINT chk_resource_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0);

ALTER TABLE cabins
  ADD CONSTRAINT chk_cabin_number_not_blank CHECK (CHAR_LENGTH(TRIM(cabin_number)) > 0);

ALTER TABLE staff
  ADD CONSTRAINT chk_staff_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0);

-- 3) Indexes for conflict checks
--CREATE INDEX idx_res_cabin_time    ON reservations (cabin_id, start_time, end_time, status);
--CREATE INDEX idx_res_resource_time ON reservations (resource_id, start_time, end_time, status);
--CREATE INDEX idx_res_staff_time    ON reservations (staff_id, start_time, end_time, status);
