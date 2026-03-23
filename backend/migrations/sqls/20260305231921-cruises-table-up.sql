-- =====================================================
-- Cruises Table
-- =====================================================

CREATE TABLE IF NOT EXISTS cruises (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cruise_name VARCHAR(100) NOT NULL,
    ship_name VARCHAR(100) NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    max_passengers INT NOT NULL,

    -- Ensure cruise ends after it begins
    CONSTRAINT chk_cruise_dates
        CHECK (return_date > departure_date),

    -- Ensure passenger capacity is positive
    CONSTRAINT chk_max_passengers_positive
        CHECK (max_passengers > 0),

    -- Prevent duplicate cruises
    CONSTRAINT unique_cruise_departure
        UNIQUE (cruise_name, departure_date)
);


-- =====================================================
-- Add Cruise Reference to Reservations
-- =====================================================

-- Step 1: Add column without NOT NULL (avoids errors if rows exist)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS cruise_id INT;

-- Step 2: Add foreign key
ALTER TABLE reservations
ADD CONSTRAINT fk_res_cruise
FOREIGN KEY (cruise_id)
REFERENCES cruises(id)
ON UPDATE CASCADE
ON DELETE CASCADE;


-- =====================================================
-- Add Cruise Reference to Cabins
-- =====================================================

ALTER TABLE cabins
ADD COLUMN IF NOT EXISTS cruise_id INT;

ALTER TABLE cabins
ADD CONSTRAINT fk_cabin_cruise
FOREIGN KEY (cruise_id)
REFERENCES cruises(id)
ON DELETE CASCADE;


-- =====================================================
-- Prevent Duplicate Cruise Bookings
-- A user cannot reserve the same cruise twice
-- =====================================================

ALTER TABLE reservations
ADD CONSTRAINT unique_user_cruise
UNIQUE (user_id, cruise_id);