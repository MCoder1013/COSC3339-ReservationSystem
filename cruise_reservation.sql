DROP DATABASE IF EXISTS cruise_reservation;
CREATE DATABASE cruise_reservation;

CREATE USER 'cruise_app'@'localhost' IDENTIFIED BY 'PutStrongPasswordHere';
GRANT ALL PRIVILEGES ON cruise_reservation.* TO 'cruise_app'@'localhost';
FLUSH PRIVILEGES;

USE cruise_reservation;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) not null,
  deck VARCHAR(20) not null,
  capacity int not null,
  status enum('active','inactive') not null default 'active'
);

CREATE TABLE people (
id INT auto_increment primary key,
name VARCHAR(100) NOT NULL,
role VARCHAR(60) NOT NULL,
shift ENUM('morning','afternoon','evening') NOT NULL,
status ENUM('active','inactive') NOT NULL DEFAULT 'active'
);

CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  status ENUM('available','maintenance','retired') NOT NULL DEFAULT 'available'
);

INSERT INTO rooms (name, deck, capacity, status) VALUES
('Excursion Briefing Room', 'Deck 5', 40, 'active'),
('Gear Checkout Room', 'Deck 3', 10, 'active'),
('Private Planning Room', 'Deck 6', 6, 'active');

INSERT INTO people (name, role, shift, status) VALUES
('Deshawn King', 'Excursion Guide', 'morning', 'active'),
('Robert Del Papa', 'Dive Instructor', 'afternoon', 'active'),
('Marcus Smart', 'Shore Photographer', 'evening', 'inactive');

INSERT INTO resources (name, quantity, status) VALUES
('Snorkel Set', 20, 'available'),
('GoPro Kit', 4, 'available'),
('Two-way Radio', 12, 'maintenance');


SHOW TABLES;
SELECT * FROM rooms;
SELECT * FROM people;
SELECT * FROM resources;





