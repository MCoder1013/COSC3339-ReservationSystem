import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";
const API_URL = import.meta.env.VITE_API_URL;

export default function SignIn() {
  const shipName = "Starlight Pearl Cruises";

  const navigate = useNavigate();

  // The variables needed to check the sign-in values w/ database
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Waiting for the sign-in button to be hit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      // Send a POST request to the backend login route with email and password
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // Throw error if something is incorrect 
      if (!res.ok) {
        throw new Error("Invalid email or password");
      }

      // Parse the JSON response body from the backend
      const data = await res.json();
      console.log("Logged in:", data);

      // For now this is where we will transfer to if successful login
      navigate("/inventory");
    } catch {
      // If error occurs this will be printed!
      setError("Login failed. Please check your credentials.");
    }
  };


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
          <h2>Sign In</h2>

          
          <form className="form" onSubmit={handleSubmit}>
            <label className="label">
              Email
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <br />

            <label className="label">
              Password
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <br />

            {error && <p className="errorText">{error}</p>}

            <button className="primaryBtn" type="submit">Sign In</button>
          </form>
          <br />
          <p>
            Need to create an account?
          </p>
          <Link className="navButton" to="/register"> Register Here </Link>

        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
