# Cruise Ship Reservation System

## Project Overview
This project is a cruise ship reservation system designed to manage onboard accommodations and shared resources for passengers and staff. The system allows users to create, manage, and track reservations in an organized and efficient way.

The application supports two main reservation categories:
- **Cabin Reservations** for passenger accommodations
- **Resource Reservations** for shared ship resources

---

## Features
- User registration and login with email validation and password complexity checks
- Cabin reservation management with multiple accommodation options
- Resource reservation management for items such as:
  - Event equipment
  - Activity gear
  - Medical supplies
  - Cleaning supplies
- Inventory management allowing items to be added and removed
- Simple frontend interface including:
  - Sign In page
  - Registration page
  - Inventory page

---

## Tech Stack
- Frontend: Simple web-based UI
- Backend: Server-based application logic
- Database: MySQL relational database
- Deployment: Cloud-based droplet

---
## Frontend Design
The frontend provides a simple, user-friendly interface for interacting with the cruise ship reservation system. It focuses on core usability and clear navigation rather than visual complexity, allowing users to easily authenticate and manage inventory-related data that is backed by the database.

## Database Design
The system uses a MySQL database to store persistent application data. The database schema includes the following core tables:

- **Users**: stores user authentication and account information
- **Staff**: stores staff-related data and permissions
- **Cabins**: stores cabin details such as type, capacity, deck, and availability
- **Resources**: stores onboard resources, categories, quantities, and availability

Sample data is included to demonstrate system functionality.

---

## Setup Instructions
1. Clone the repository
2. Set up a MySQL database
3. Run the provided SQL script to create tables and insert sample data
4. Start the backend server
5. Access the application through the frontend interface

---

## Team Roles
- Database Design & Documentation: Bart Vallejo, Deshawn King
- Backend Development: Matias Botero, Matthew DeVaney
- Frontend Development: Lindsey Soltis, Dean Roggenbauer
