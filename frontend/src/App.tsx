import "./App.css";
import { Link, useNavigate } from "react-router-dom";

export default function App() {
  const shipName = "Starlight Pearl Cruises";
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="navbar">
        <div className="container headerRow">
          <img src="images/StarlightPearlLogoWithName.png" 
          alt="Starlight Pearl Cruises Logo" className="logo" />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            <Link className="navButton" to="/signin">Sign In</Link>
            <Link className="navButton" to="/inventory">Inventory</Link>
          </nav>

        </div>
      </header>

      <main className="container">
        <section className="section">
          <h2>Sail Where the Stars Lead</h2>
          <h3>Your ocean journey, guided by starlight.</h3>

          <button onClick={() => navigate("/signin")}>Book Your Trip</button>
        </section>

        {/* <section className="section">
          <h2>Popular Destinations</h2>
          <ul className="list">
            <li>Bahamas</li>
            <li>Alaska</li>
            <li>Hawaii</li>
          </ul>
        </section> */}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
