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
        <section className="section">
          <h2>Sail Where the Stars Lead</h2>
          <h3>Your ocean journey, guided by starlight.</h3>

          {user ? (
            <div className="welcomeSection">
              <p className="welcomeMessage">Welcome back, {user.firstName}!</p>
              <div className="userActions">
                <button onClick={() => navigate("/user-reservations")} className="primaryBtn">View Your Reservations</button>
                <button onClick={() => navigate("/inventory")} className="primaryBtn">Browse Inventory</button>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate("/signin")}>Book Your Trip</button>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}