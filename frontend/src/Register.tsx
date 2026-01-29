import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";

export default function Register() {
  const shipName = "Starlight Pearl Cruises";
  const navigate = useNavigate();

  // Variables to hold all information related to the users as they register
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Confirm that both passwords are matching
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
       // Send a POST request to the backend registration
      const res = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await res.json();

      // Throw error if something is incorrect 
      if (!res.ok || data.error) {
        setError(data.error || "Registration failed");
        return;
      }

      // If successful creation of account then we redirect to login
      setSuccess("Account created successfully!");
      setTimeout(() => navigate("/signin"), 1500);
    } catch {
      setError("Registration failed. Please try again.");
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
            <Link className="navButton" to="/">Home</Link>
          </nav>
        </div>
      </header>

      <main className="container centeredContent">
        <section className="centerCard">
          <h2>Register</h2>

          <form className="form" onSubmit={handleSubmit}>
            <label className="label">
              First Name:
              <input
                className="input"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>

            <br />

            <label className="label">
              Last Name:
              <input
                className="input"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>

            <br />

            <label className="label">
              Email:
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <br />

            <label className="label">
              Password:
              <input
                className="input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <br />

            <label className="label">
              Confirm Password:
              <input
                className="input"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            <br />

            {error && <p className="errorText">{error}</p>}
            {success && <p className="successText">{success}</p>}

            <button className="primaryBtn" type="submit">Register</button>
          </form>

          <br />

          <p>Already have an account?</p>
          <Link className="navButton" to="/signin">Sign In Here</Link>
        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
