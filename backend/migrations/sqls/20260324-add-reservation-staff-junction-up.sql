CREATE TABLE reservation_staff (
    reservation_id INT NOT NULL,
    staff_id INT NOT NULL,

    PRIMARY KEY (reservation_id, staff_id),

    FOREIGN KEY (reservation_id)
        REFERENCES reservations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id)
        ON DELETE CASCADE
);

ALTER TABLE reservations
DROP CONSTRAINT IF EXISTS reservations_staff_id_fkey;

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_res_staff_reservation ON reservation_staff(reservation_id);
CREATE INDEX idx_res_staff_staff ON reservation_staff(staff_id);
