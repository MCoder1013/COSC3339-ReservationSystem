import "./App.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import NavBar from "./NavBar";

export default function App() {
  const shipName = "Starlight Pearl Cruises";
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container">
        {!user ? (
          // Unsigned in: Browse and Book options
          <section className="section">
            <h2>Sail Where the Stars Lead</h2>
            <h3>Your ocean journey, guided by starlight.</h3>
            <p>Explore our exclusive cruise amenities and book your perfect vacation.</p>
            
            <div className="homeActionButtons">
              <button onClick={() => navigate("/inventory")} className="primaryBtn">
                Browse Inventory
              </button>
              <button onClick={() => navigate("/signin")} className="primaryBtn">
                Book Your Trip
              </button>
            </div>
          </section>
        ) : (
          // Signed in: Welcome dashboard
          <section className="section welcomeDashboard">
            <div className="dashboardContent">
              <h2>Welcome back, {user.firstName}!</h2>
              <p className="dashboardSubtitle">Your voyage awaits</p>
              
              <div className="dashboardGrid">
                <div className="dashboardCard">
                  <h3>My Reservations</h3>
                  <p>View and manage your current bookings</p>
                  <button onClick={() => navigate("/user-reservations")} className="primaryBtn">
                    View Reservations
                  </button>
                </div>
                
                <div className="dashboardCard">
                  <h3>Make a Reservation</h3>
                  <p>Book rooms, items, or exclusive packages</p>
                  <button onClick={() => navigate("/reservation")} className="primaryBtn">
                    New Reservation
                  </button>
                </div>
                
                <div className="dashboardCard">
                  <h3>Browse Inventory</h3>
                  <p>Explore available items and amenities</p>
                  <button onClick={() => navigate("/inventory")} className="primaryBtn">
                    Browse
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}