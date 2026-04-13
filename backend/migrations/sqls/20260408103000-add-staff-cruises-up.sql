CREATE TABLE IF NOT EXISTS staff_cruises (
    staff_id INT NOT NULL,
    cruise_id INT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (staff_id, cruise_id),

    CONSTRAINT fk_staff_cruises_staff
        FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_staff_cruises_cruise
        FOREIGN KEY (cruise_id)
        REFERENCES cruises(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_cruises_staff_id
    ON staff_cruises(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_cruises_cruise_id
    ON staff_cruises(cruise_id);
