ALTER TABLE users
    ADD COLUMN IF NOT EXISTS biography VARCHAR(255),
    ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255),
    ADD COLUMN IF NOT EXISTS user_role VARCHAR(20);

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS user_role_check;

ALTER TABLE users
    ADD CONSTRAINT user_role_check
    CHECK (user_role IN ('normal', 'staff'));

ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS reservations_staff_id_fkey;

DROP TABLE IF EXISTS staff;

CREATE TABLE IF NOT EXISTS staff (
    staff_id INT PRIMARY KEY,
    role VARCHAR(50) NOT NULL DEFAULT 'Other',
    shift VARCHAR(20) NOT NULL DEFAULT 'Day',

    CONSTRAINT fk_staff_user
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- CREATE TABLE IF NOT EXISTS reservation_groups (
--     user_id INT NOT NULL,
--     reservation_id INT NOT NULL,

--     CONSTRAINT fk_res_group_user
--         FOREIGN KEY (user_id) REFERENCES users(id)
--         ON UPDATE CASCADE
--         ON DELETE RESTRICT,

--     CONSTRAINT fk_res_group_info
--         FOREIGN KEY (reservation_id) REFERENCES reservations(id)
--         ON UPDATE CASCADE
--         ON DELETE RESTRICT
-- );
