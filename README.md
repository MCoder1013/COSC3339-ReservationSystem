# Cruise Ship Reservation System

## Project Overview

This project is a cruise ship reservation system designed to manage onboard accommodations and shared resources for passengers and staff. The system allows users to create, manage, and track reservations in an organized and efficient way.

Users can log in to the system, browse available resources, create reservations, and manage their existing bookings through an interactive web interface.

The application supports two primary reservation categories:

* **Cabin Reservations** for passenger accommodations on the ship
* **Resource Reservations** for shared ship items and equipment

The system is designed to demonstrate relational database design, reservation validation logic, and a functional web-based reservation interface.

---

## Features

* User registration and authentication system
* Reservation creation for cabins, resources, and packages
* Reservation management allowing users to view and modify their bookings
* Reservation history organized by **past, current, and future reservations**
* Tabular reservation display including reservation ID, reserved item, user email, start date, and end date
* Inventory tracking for ship resources
* Administrative tools for managing reservations and users
* User profile page displaying account information and reservation history
* Web-based dashboard interface for navigating reservation actions

---

## Tech Stack

* **Frontend:** Web-based user interface
* **Backend:** Server-side application logic
* **Database:** PostgreSQL relational database
* **Deployment:** Cloud-based server (droplet)

---
## Frontend Design

The frontend provides a web-based user interface that allows passengers to interact with the cruise reservation system. The interface is designed as a simple dashboard that allows users to quickly view and manage their reservations.

After logging in, users are welcomed with a homepage dashboard where they can access two primary actions:

* **View Reservations** – Allows users to see their current reservations and manage existing bookings.
* **Make a Reservation** – Allows users to create a new reservation for available items, rooms, or packages.

The reservation management interface displays reservations in a tabular format showing the reservation ID, reserved item, quantity, user email, reservation start time, reservation end time, and available actions such as modifying the reservation.

Users can organize and view their reservations by category including **Items, Rooms, and Packages**. Reservations are also grouped by time status so that users can easily view **past, current, and future reservations**.

The application also includes a **User Profile page**, where users can view their reservation history and manage personal profile information. From this page, users can review reservations across different time periods and update their profile information.

## Database Design

The Cruise Reservation System uses a **PostgreSQL** relational database to manage users, staff, ship cabins, onboard resources, and reservations. The database is designed with relational integrity in mind, using primary keys and structured relationships between tables to ensure consistent and reliable data storage.

The database consists of the following core tables:

* **users** – Stores passenger account information including user ID, email address, name, and authentication data used for logging into the system.
* **staff** – Stores staff member information used for managing cruise operations and administrative system functions.
* **cabins** – Stores information about ship cabins including cabin number, deck location, and cabin type.
* **resources** – Stores onboard reservable resources such as equipment, medical supplies, event materials, and other ship inventory items.
* **reservations** – Tracks reservations made by users for cabins or other reservable resources. Each reservation includes information such as the user making the reservation, the reserved item, and the reservation time period.
* **reservation_groups** – Allows multiple reservations to be grouped together, which is useful for managing reservations made as part of the same booking or trip.
* **migrations** – Tracks database schema changes and migration history to ensure the database structure remains consistent across updates.

Together, these tables support the reservation workflow by linking users to reservable items while maintaining a structured history of both past and active reservations.


## Setup Instructions

1. Clone the project repository to your local machine.
2. Create a PostgreSQL database for the application.
3. Run the provided SQL schema file to create all required tables and database structures.
4. Insert the sample data included with the project to populate the database with users, cabins, resources, and reservations.
5. Configure the backend server with the correct database connection credentials.
6. Start the backend server.
7. Open the web application in your browser to access the cruise reservation system interface.


## Team Roles
- Database Design & Documentation: Bart Vallejo, Deshawn King
- Backend Development: Matias Botero, Matthew DeVaney
- Frontend Development: Lindsey Soltis, Dean Roggenbauer

