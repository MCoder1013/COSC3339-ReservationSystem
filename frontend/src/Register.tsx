import { Link } from "react-router-dom";
import "./App.css";

export default function Register() {
const shipName = "Starlight Pearl Cruises";

  return (
    <div className="page">
      <header className="navbar">
        <div className="container headerRow">
          <img src="images/StarlightPearlLogoWithName.png" 
            alt="Starlight Pearl Cruises Logo" className="logo" />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            <Link className="navButton" to="/">Home</Link>
          </nav>

        </div>
      </header>

      <main className="container centeredContent">
        <section className="centerCard">
          <h2>Register</h2>

          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <label className="label">
              First Name: 
              <input className="input" type="text" placeholder="Your First Name" required />
            </label>

            <br />

            <label className="label">
              Last Name: 
              <input className="input" type="text" placeholder="Your Last Name" required />
            </label>

            <br />

            <label className="label">
              Email: 
              <input className="input" type="email" placeholder="you@example.com" required />
            </label>

            <br />

            <label className="label">
              Password: 
              <input className="input" type="password" placeholder="••••••••" required />
            </label>

            <br />

            <label className="label">
              Confirm Password: 
              <input className="input" type="password" placeholder="••••••••" required />
            </label>

            <br />
            <button className="primaryBtn" type="submit">Register</button>
          </form>
          
          <br />
          
          <p> Already have an account? </p>
          <Link className="navButton" to="/signin"> Sign In Here </Link>

        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
