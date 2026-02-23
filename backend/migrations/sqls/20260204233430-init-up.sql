-- 1) Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 2) Cabins (rooms)
CREATE TYPE cabin_type AS ENUM('Economy','Oceanview','Balcony','Suite');
CREATE TYPE cabin_status AS ENUM('Available', 'Unavailable', 'Maintenance');
CREATE TABLE IF NOT EXISTS cabins (
  id SERIAL PRIMARY KEY,
  cabin_number VARCHAR(10) NOT NULL UNIQUE, -- example  C101, B202
  deck INT NOT NULL,
  type CABIN_TYPE NOT NULL,
  capacity INT NOT NULL,
  status CABIN_STATUS NOT NULL DEFAULT 'Available'
);

-- 3) Resources
CREATE TYPE resources_status AS ENUM('Available', 'Out', 'Maintenance');
CREATE TYPE resources_category AS ENUM('Gear', 'Medical', 'Event', 'Cleaning', 'Other');
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category RESOURCES_CATEGORY NOT NULL DEFAULT 'Other',
  quantity INT NOT NULL,
  status RESOURCES_STATUS NOT NULL DEFAULT 'Available'
);

-- 4) Staff (people)
CREATE TYPE staff_role AS ENUM('Nurse', 'Tour Guide', 'Security', 'Housekeeping', 'Other');
CREATE TYPE staff_shift AS ENUM('Morning', 'Day', 'Night');
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role STAFF_ROLE NOT NULL DEFAULT 'Other',
  email VARCHAR(255) NOT NULL UNIQUE,
  shift STAFF_SHIFT NOT NULL DEFAULT 'Day'
);

-- 5) Reservations (with foreign key constraints)
CREATE TYPE reservations_status AS ENUM('Pending','Confirmed','Cancelled');
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  cabin_id INT NULL REFERENCES cabins(id),
  resource_id INT NULL REFERENCES resources(id),
  staff_id INT NULL REFERENCES staff(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status RESERVATIONS_STATUS NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_res_user ON reservations(user_id);
CREATE INDEX idx_res_cabin ON reservations(cabin_id);
CREATE INDEX idx_res_resource ON reservations(resource_id);
CREATE INDEX idx_res_staff ON reservations(staff_id);
