import { Link} from "react-router-dom";
import { useState } from "react";
import "./App.css";
import { submitData } from "./api";

export default function SignIn() {
  const shipName = "Starlight Pearl Cruises";

  // The variables needed to check the sign-in values w/ database
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [logInMessage, setLogInMessage] = useState('');

  // Waiting for the sign-in button to be hit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const data = await submitData('/api/auth/login', {
        email, password
      });
      if (data.error) {
        setError(data.error);
        setLogInMessage("");
        return
      }

      // Parse the JSON response body from the backend
      // console.log("Logged in:", data);
      setLogInMessage("Successful login!");
      setError("");
      setEmail("");
      setPassword("");
    } catch {
      // If error occurs this will be printed!
      setError("Login failed. Please check your credentials.");
      setLogInMessage("");
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
            {logInMessage ? <p className="register-message">{logInMessage}</p> : <></>}

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
