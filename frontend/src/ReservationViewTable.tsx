import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
const API_URL = import.meta.env.VITE_API_URL;

export default function ReservationTable() {
  const shipName = "Starlight Pearl Cruises";
  const [formError, setFormError] = useState<string>("");

  // tabs
  const categories = ["Items", "Packages"] as const;

  // current selected tab
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");

  const [reservationData, setReservationData] = useState<{
    Items: any[];
    Packages: any[];
  }>({
    Items: [],
    Packages: [],
  });

  const [loading, setLoading] = useState(true);

  // Function to format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Fetch reservations from backend API
  useEffect(() => {
    const loadReservations = async () => {
      setLoading(true);
      try {
        const itemsData = await fetchData("/api/reservations/items");
        const packagesData = await fetchData("/api/reservations/packages");

        setReservationData({
          Items: itemsData,
          Packages: packagesData,
        });
      } catch (error) {
        console.error("Error fetching reservations:", error);
        setFormError("Failed to load reservations");
      } finally {
        setLoading(false);
      }
    };

    loadReservations();
  }, []);

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
          <div style={{ textAlign: "center", padding: "40px", fontSize: "18px", color: "#666" }}>
            <p>Coming Soon</p>
          </div>
        ) : loading ? (
          <p>Loading reservations...</p>
        ) : reservationData[activeCategory].length === 0 ? (
          <p>No items reservations found.</p>
        ) : (
          /* Changes table dynamically */
          <table className="inventoryTable">
            <thead>
              {activeCategory === "Items" ? (
                <tr>
                  <th>Guest Name</th>
                  <th>Resource Name</th>
                  <th>Category</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              ) : (
                <tr>
                  <th>Guest Name</th>
                  <th>Cabin Number</th>
                  <th>Type</th>
                  <th>Deck</th>
                  <th>Capacity</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              )}
            </thead>

            <tbody>
              {reservationData[activeCategory].map((reservation) =>
                activeCategory === "Items" ? (
                  <tr key={reservation.id}>
                    <td>{`${reservation.first_name} ${reservation.last_name}`}</td>
                    <td>{reservation.resource_name}</td>
                    <td>{reservation.category}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>{reservation.status}</td>
                  </tr>
                ) : (
                  <tr key={reservation.id}>
                    <td>{`${reservation.first_name} ${reservation.last_name}`}</td>
                    <td>{reservation.cabin_number}</td>
                    <td>{reservation.type}</td>
                    <td>{reservation.deck}</td>
                    <td>{reservation.capacity}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>{reservation.status}</td>
                  </tr>
                )
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
