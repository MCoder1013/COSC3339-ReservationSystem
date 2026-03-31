import NavBar from "./NavBar";
import "./App.css";

export default function Analytics() {
  const shipName = "Starlight Pearl Cruises";

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container centeredContent">
        <section className="centerCard">
          <h2>Analytics</h2>
          <p>Coming soon!</p>
        </section>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
