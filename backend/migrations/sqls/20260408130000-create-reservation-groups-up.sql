CREATE TABLE IF NOT EXISTS reservation_groups (
    user_id INT NOT NULL,
    reservation_id INT NOT NULL,

    PRIMARY KEY (user_id, reservation_id),

    CONSTRAINT fk_res_group_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_res_group_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservation_groups_reservation
    ON reservation_groups(reservation_id);
