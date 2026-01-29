import { useState } from "react";
import "./App.css";
import { Link } from "react-router-dom";

export default function Inventory() {
const shipName = "Starlight Pearl Cruises";

  // ✅ 1. Categories
  const categories = ["Food", "Attractions"] as const;

  // ✅ 2. Current selected category
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Food");

  // ✅ 3. Dummy data (later replaced by DB)
  const inventoryData = {
    Food: ["Pizza Buffet", "Seafood Night", "Coffee Bar", "Ice Cream Deck"],
    Attractions: ["Water Slide", "Live Music Lounge", "Movie Theater", "Spa"],
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

        <main className="container section inventoryDisplay">
        <h2>Inventory</h2>

        {/* ✅ Buttons to switch categories */}
        <div className="tabButtons">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={activeCategory === category ? "activeTab" : ""}
            >
              {category}
            </button>
          ))}
        </div>

        {/* ✅ List changes dynamically */}
        <ul className="inventoryList">
          {inventoryData[activeCategory].map((item) => (
            <li key={item} className="inventoryItem">
              {item}
            </li>
          ))}
        </ul>
      </main>

    </div>
  );
}
