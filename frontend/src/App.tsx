import "./App.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function App() {
  const shipName = "Starlight Pearl Cruises";
  const navigate = useNavigate();
  const { user } = useAuth();

  const isStaff = user?.user_role === "staff";
  const isNormal = user?.user_role === "normal";

  return (
    <div className="page">
      <header className="navbar">
        <div className="container headerRow">
          <img src="images/StarlightPearlLogoWithName.png"
            alt="Starlight Pearl Cruises Logo" className="logo" />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            {!user && <Link className="navButton" to="/signin">Sign In</Link>}
            {(user) && <Link className="navButton" to="/">Home</Link>}
            {isStaff && <Link className="navButton" to="/inventory">Inventory</Link>}
            {isStaff && <Link className="navButton" to="/reservations">Reservations</Link>}
            {isStaff && <Link className="navButton" to="/profile">Profile</Link>}
            {isNormal && <Link className="navButton" to="/user-reservations">My Reservations</Link>}
            {isNormal && <Link className="navButton" to="/profile">Profile</Link>}
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="section">
          <h2>Sail Where the Stars Lead</h2>
          <h3>Your ocean journey, guided by starlight.</h3>
          {!user && <button onClick={() => navigate("/signin")}>Book Your Trip</button>}
        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}