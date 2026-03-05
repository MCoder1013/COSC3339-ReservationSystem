import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./App.css";
import { submitData } from "./api";
import { useAuth } from "./AuthContext";
import NavBar from "./NavBar";

export default function SignIn() {
  const shipName = "Starlight Pearl Cruises";

  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [logInMessage, setLogInMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const data = await submitData("/api/auth/login", { email, password });

      if (data.error) {
        setError(data.error);
        setLogInMessage("");
        return;
      }

      // Store user info in auth state
      login({
        userId: data.userId,
        firstName: data.firstName,
        role: data.role
      });

      setLogInMessage("Successful login!");
      setError("");
      setEmail("");
      setPassword("");

      setTimeout(() => {
        navigate("/");
      }, 1000);

    } catch {
      setError("Login failed. Please check your credentials.");
      setLogInMessage("");
    }
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

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
            {logInMessage && <p className="register-message">{logInMessage}</p>}

            <button className="primaryBtn" type="submit">Sign In</button>
          </form>

          <br />
          <p>Need to create an account?</p>
          <Link className="navButton" to="/register">Register Here</Link>
        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}