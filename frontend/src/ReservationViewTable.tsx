/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
const API_URL = import.meta.env.VITE_API_URL;

export default function ReservationTable() {
  const shipName = "Starlight Pearl Cruises";
  const [formError, setFormError] = useState<string>("");

  // tabs
  const categories = ["Items", "Rooms", "Packages"] as const;

  // current selected tab
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");

  const [reservationData, setReservationData] = useState<{
    Items: any[];
    Rooms: any[];
    Packages: any[];
  }>({
    Items: [],
    Rooms: [],
    Packages: [],
  });

  const [loading, setLoading] = useState(true);

  // Function to format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const allReservations = await fetchData("/api/reservations");
      
      const now = new Date();

      const itemReservations = allReservations
        .filter(
          (res: any) => 
            res.resource_id !== null && 
            res.cabin_id === null &&
            new Date(res.end_time) >= now
        )
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const roomReservations = allReservations
        .filter(
          (res: any) => 
            res.cabin_id !== null && 
            res.resource_id === null &&
            new Date(res.end_time) >= now
        )
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const packageReservations: any[] = [];

      setReservationData({
        Items: itemReservations,
        Rooms: roomReservations,
        Packages: packageReservations,
      });
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setFormError("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleDeleteReservation = async (reservationId: number) => {
    try {
      console.log("Deleting reservation:", reservationId);
      
      const response = await fetch(`${API_URL}/api/reservations/${reservationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        await loadReservations();
        setFormError("");
        return;
      }

      let errorMessage = `Failed to delete reservation (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (jsonError) {
        console.log(jsonError);
      }

      setFormError(errorMessage);
      
      await loadReservations();
      
    } catch (error) {
      console.error("Exception during delete:", error);
      setFormError("Failed to delete reservation. Please try again.");
      
      await loadReservations();
    }
  };

  return (
    <div className="page">
      <header className="navbar">
        <div className="container headerRow">
          <img
            src="images/StarlightPearlLogoWithName.png"
            alt="Starlight Pearl Cruises Logo"
            className="logo"
          />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            <Link className="navButton" to="/">
              Home
            </Link>
            <Link className="navButton" to="/user-reservations">
              User Reservations
            </Link>
          </nav>
        </div>
      </header>

      <main className="container section inventoryDisplay">
        <h2>Reservations</h2>

        {/* Buttons to switch categories */}
        <div className="tabButtons">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={activeCategory === category ? "activeTab" : ""}
            >
              {category}
            </button>
          ))}
        </div>

        <br />

        {formError && (
          <div className="errorMessage">{formError}</div>
        )}

        {activeCategory === "Packages" ? (
          <div style={{ textAlign: "center", padding: "40px", fontSize: "18px", color: "white" }}>
            <p>Package Reservations Coming Soon!</p>
          </div>
        ) : loading ? (
          <p>Loading reservations...</p>
        ) : reservationData[activeCategory].length === 0 ? (
          <p>No {activeCategory.toLowerCase()} reservations found.</p>
        ) : (
          /* Changes table dynamically */
          <table className="inventoryTable">
            <thead>
              {activeCategory === "Items" ? (
                <tr>
                  <th>Reservation ID</th>
                  <th>Item Reserved</th>
                  <th>Quantity</th>
                  <th>User Email</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              ) : activeCategory === "Rooms" ? (
                <tr>
                  <th>Reservation ID</th>
                  <th>Cabin Number</th>
                  <th>User Email</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Reservation ID</th>
                  <th>Package Name</th>
                  <th>User Email</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>

            <tbody>
              {reservationData[activeCategory].map((reservation) =>
                activeCategory === "Items" ? (
                  <tr key={reservation.id}>
                    <td>{reservation.id}</td>
                    <td>{reservation.resource_name}</td>
                    <td>{reservation.quantity_reserved}</td>
                    <td>{reservation.email}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>
                      <button 
                        className="deleteButton"
                        onClick={() => handleDeleteReservation(reservation.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ) : activeCategory === "Rooms" ? (
                  <tr key={reservation.id}>
                    <td>{reservation.id}</td>
                    <td>{reservation.cabin_number}</td>
                    <td>{reservation.email}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>
                      <button 
                        className="deleteButton"
                        onClick={() => handleDeleteReservation(reservation.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}