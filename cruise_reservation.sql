CREATE DATABASE IF NOT EXISTS cruise_reservation
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE cruise_reservation;

-- 1) Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 2) Cabins (rooms)
CREATE TABLE IF NOT EXISTS cabins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cabin_number VARCHAR(10) NOT NULL UNIQUE,   ## example  C101, B202
  deck INT NOT NULL,
  type ENUM('Economy','Oceanview','Balcony','Suite') NOT NULL,
  capacity INT NOT NULL,
  status ENUM('Available','Unavalible','Maintenance') NOT NULL DEFAULT 'Available'
);

-- 3) Resources
CREATE TABLE IF NOT EXISTS resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('Gear','Medical','Event','cleaning','Other') NOT NULL DEFAULT 'Other',
  quantity INT NOT NULL,
  status ENUM('Available','Out','Maintenance') NOT NULL DEFAULT 'Available'
);

-- 4) Staff (people)
CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role ENUM('Nurse','Tour Guide','Security','Housekeeping','Other') NOT NULL DEFAULT 'Other',
  email VARCHAR(255) NOT NULL UNIQUE,
  shift ENUM('Morning','Day','Night') NOT NULL DEFAULT 'Day'
);

-- 5) Reservations (with foreign key constraints)
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  cabin_id INT NULL,
  resource_id INT NULL,
  staff_id INT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('Pending','Confirmed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_res_user (user_id),
  INDEX idx_res_cabin (cabin_id),
  INDEX idx_res_resource (resource_id),
  INDEX idx_res_staff (staff_id),

  CONSTRAINT fk_res_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_res_cabin
    FOREIGN KEY (cabin_id) REFERENCES cabins(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_res_resource
    FOREIGN KEY (resource_id) REFERENCES resources(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_res_staff
    FOREIGN KEY (staff_id) REFERENCES staff(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

    




