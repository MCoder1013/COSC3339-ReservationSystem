import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";

export default function ReservationTable() {
  const shipName = "Starlight Pearl Cruises";
  const [formError, setFormError] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // tabs
  const categories = ["Items", "Packages"] as const;

  // current selected tab
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");

  const [reservationData, setReservationData] = useState<any[]>([]);

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
      setFormError("");
      try {
        const itemsData = await fetchData("/api/reservations/items");
        setReservationData(itemsData);
        setIsAuthenticated(true);
      } catch (error: any) {
        console.error("Error fetching reservations:", error);
        if (error.message.includes('401') || error.message.includes('Not authenticated')) {
          setFormError("Please sign in to view your reservations");
          setIsAuthenticated(false);
        } else {
          setFormError("Failed to load reservations");
        }
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
          </nav>
        </div>
      </header>

      <main className="container section inventoryDisplay">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>My Reservations</h2>
          {isAuthenticated && (
            <Link to="/reservation">
              <button className="primaryButton" style={{ padding: '10px 20px', fontSize: '16px' }}>
                Make Reservation
              </button>
            </Link>
          )}
        </div>

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
          <div className="errorMessage" style={{ textAlign: 'center', padding: '20px' }}>
            {formError}
            {!isAuthenticated && (
              <div style={{ marginTop: '10px' }}>
                <Link to="/signin" className="primaryButton" style={{ padding: '10px 20px', textDecoration: 'none', display: 'inline-block' }}>
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}

        {activeCategory === "Packages" ? (
          <div style={{ textAlign: "center", padding: "40px", fontSize: "18px", color: "#666" }}>
            <p>Coming Soon</p>
          </div>
        ) : loading ? (
          <p>Loading your reservations...</p>
        ) : reservationData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>You have no item reservations yet.</p>
            <Link to="/reservation">
              <button className="primaryButton" style={{ padding: '10px 20px', fontSize: '16px', marginTop: '20px' }}>
                Make Your First Reservation
              </button>
            </Link>
          </div>
        ) : (
          /* Item reservations table */
          <table className="inventoryTable">
            <thead>
              <tr>
                <th>Guest Name</th>
                <th>Resource Name</th>
                <th>Category</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {reservationData.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{`${reservation.first_name} ${reservation.last_name}`}</td>
                  <td>{reservation.resource_name}</td>
                  <td>{reservation.category}</td>
                  <td>{formatDateTime(reservation.start_time)}</td>
                  <td>{formatDateTime(reservation.end_time)}</td>
                  <td>{reservation.status}</td>
                </tr>
              ))}
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
