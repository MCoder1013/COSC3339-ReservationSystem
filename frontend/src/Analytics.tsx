import NavBar from "./NavBar";
import "./App.css";
import { useAuth } from "./AuthContext";

export default function Analytics() {
  const shipName = "Starlight Pearl Cruises";
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section centerCard">
        <h2>Analytics</h2>
        {isAdmin ? (
          <p>Coming soon.</p>
        ) : (
          <p>Access denied. Admin role required.</p>
        )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
