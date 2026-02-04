import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
const API_URL = import.meta.env.VITE_API_URL;

export default function Inventory() {
const shipName = "Starlight Pearl Cruises";

  // ✅ 1. Categories
  const categories = ["Rooms", "Items"] as const;

  // ✅ 2. Current selected category
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Rooms");
  
  // ✅ 3. Inventory data from backend (or dummy data as fallback)
  // const [inventoryData, setInventoryData] = useState({
  //   Rooms: ["Ocean View Suite", "Balcony Cabin", "Interior Room", "Family Suite"],
  //   Items: ["Sunscreen", "Beach Towel", "Snorkel Gear", "Travel Pillow"],
  // });

  const [inventoryData, setInventoryData] = useState<{
    Rooms: any[];
    Items: any[];
  }>({
    Rooms: [],
    Items: [],
  });

  // ✅ 4. Modal state
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // ✅ 5. Form data for rooms
  const [roomForm, setRoomForm] = useState({
    cabin_number: "",
    deck: "",
    type: "Economy",
    capacity: "",
    status: "Available"
  });
  
  // ✅ 6. Form data for items
  const [itemForm, setItemForm] = useState({
    name: "",
    category: "Other",
    quantity: "",
    status: "Available"
  });

  // ✅ 7. Delete form state
  const [deleteId, setDeleteId] = useState("");

  // ✅ 7. Fetch data from backend API
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const roomsData = await fetchData("/api/rooms");
        const itemsData = await fetchData("/api/resources");

        setInventoryData({
          Rooms: roomsData,
          Items: itemsData,
        });
      } catch (error) {
        console.error("Error fetching inventory:", error);
      }
    };

    loadInventory();
  }, []);


  // ✅ 8. Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const endpoint =
        activeCategory === "Rooms" ? "/api/rooms" : "/api/resources";

      const body =
        activeCategory === "Rooms" ? roomForm : itemForm;

      await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // 🔄 Refresh inventory
      const roomsData = await fetchData("/api/rooms");
      const itemsData = await fetchData("/api/resources");

      setInventoryData({
        Rooms: roomsData,
        Items: itemsData,
      });

      setShowModal(false);
    } catch (error) {
      console.error("Failed to add inventory item:", error);
    }
  };

  // ✅ 9. Handle delete submission
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const endpoint =
        activeCategory === "Rooms"
          ? `/api/rooms/${deleteId}`
          : `/api/resources/${deleteId}`;

      await fetch(`${API_URL}${endpoint}`, {
        method: "DELETE",
      });

      // 🔄 Refresh inventory
      const roomsData = await fetchData("/api/rooms");
      const itemsData = await fetchData("/api/resources");

      setInventoryData({
        Rooms: roomsData,
        Items: itemsData,
      });

      setShowDeleteModal(false);
      setDeleteId("");
    } catch (error) {
      console.error("Failed to delete item:", error);
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

          <br />

        {/* ✅ Add/Delete buttons */}
        <button className="addButton" onClick={() => setShowModal(true)}>
          Add {activeCategory.slice(0, -1)}
        </button>
        <button className="deleteButton" onClick={() => setShowDeleteModal(true)}>Delete {activeCategory.slice(0, -1)}</button>

        {/* ✅ List changes dynamically */}
        <ul className="inventoryList">
          {inventoryData[activeCategory].map((item) => (
            <li key={item.id} className="inventoryItem">
              {activeCategory === "Rooms" ? (
                <>
                  Cabin {item.cabin_number} — Deck {item.deck} — {item.type} — {item.status}
                </>
              ) : (
                <>
                  {item.name} ({item.category}) — Qty: {item.quantity} — {item.status}
                </>
              )}
            </li>
          ))}
        </ul>
      </main>

      {/* ✅ Modal for adding rooms/items */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Add {activeCategory.slice(0, -1)}</h3>
            
            <form onSubmit={handleSubmit}>
              {activeCategory === "Rooms" ? (
                // Room form
                <>
                  <label>
                    Cabin Number:
                    <input
                      type="text"
                      placeholder="e.g., C101, B202"
                      value={roomForm.cabin_number}
                      onChange={(e) => setRoomForm({...roomForm, cabin_number: e.target.value})}
                      required
                    />
                  </label>

                  <label>
                    Deck:
                    <input
                      type="number"
                      placeholder="Deck number"
                      value={roomForm.deck}
                      onChange={(e) => setRoomForm({...roomForm, deck: e.target.value})}
                      required
                    />
                  </label>

                  <label>
                    Type:
                    <select
                      value={roomForm.type}
                      onChange={(e) => setRoomForm({...roomForm, type: e.target.value})}
                    >
                      <option value="Economy">Economy</option>
                      <option value="Oceanview">Oceanview</option>
                      <option value="Balcony">Balcony</option>
                      <option value="Suite">Suite</option>
                    </select>
                  </label>

                  <label>
                    Capacity:
                    <input
                      type="number"
                      min="1"
                      placeholder="Number of guests"
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm({...roomForm, capacity: e.target.value})}
                      required
                    />
                  </label>

                  <label>
                    Status:
                    <select
                      value={roomForm.status}
                      onChange={(e) => setRoomForm({...roomForm, status: e.target.value})}
                    >
                      <option value="Available">Available</option>
                      <option value="Unavalible">Unavalible</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </label>
                </>
              ) : (
                // Items form
                <>
                  <label>
                    Name:
                    <input
                      type="text"
                      placeholder="Item name"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                      required
                    />
                  </label>

                  <label>
                    Category:
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({...itemForm, category: e.target.value})}
                    >
                      <option value="Gear">Gear</option>
                      <option value="Medical">Medical</option>
                      <option value="Event">Event</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label>
                    Quantity:
                    <input
                      type="number"
                      min="1"
                      placeholder="Quantity"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({...itemForm, quantity: e.target.value})}
                      required
                    />
                  </label>

                  <label>
                    Status:
                    <select
                      value={itemForm.status}
                      onChange={(e) => setItemForm({...itemForm, status: e.target.value})}
                    >
                      <option value="Available">Available</option>
                      <option value="Out">Out</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </label>
                </>
              )}

              <button type="submit" className="submitButton">Submit</button>
              <button type="button" onClick={() => setShowModal(false)} className="cancelButton">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Modal for deleting rooms/items */}
      {showDeleteModal && (
        <div className="modal" onClick={() => setShowDeleteModal(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {activeCategory.slice(0, -1)}</h3>
            
            <form onSubmit={handleDeleteSubmit}>
              <label>
                {activeCategory === "Rooms" ? "Cabin Number:" : "Resource Name:"}
                <input
                  type="text"
                  placeholder={activeCategory === "Rooms" ? "Enter cabin number (e.g., A101)" : "Enter resource name"}
                  value={deleteId}
                  onChange={(e) => setDeleteId(e.target.value)}
                  required
                />
              </label>

              <button type="submit" className="submitButton">Delete</button>
              <button type="button" onClick={() => setShowDeleteModal(false)} className="cancelButton">Cancel</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
