import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
const API_URL = import.meta.env.VITE_API_URL;

export default function Inventory() {
const shipName = "Starlight Pearl Cruises";

const [formError, setFormError] = useState<string>("");

  //tabs
  const categories = ["Rooms", "Items"] as const;

  //current selected tab
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Rooms");

  const [inventoryData, setInventoryData] = useState<{
    Rooms: any[];
    Items: any[];
  }>({
    Rooms: [],
    Items: [],
  });

  //modal state
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  //form data for rooms
  const [roomForm, setRoomForm] = useState({
    cabin_number: "",
    deck: "",
    type: "Economy",
    capacity: "",
    status: "Available"
  });
  
  //form data for items
  const [itemForm, setItemForm] = useState({
    name: "",
    category: "Other",
    quantity: "",
    status: "Available"
  });

  //delete form state
  const [deleteId, setDeleteId] = useState("");

  //fetch data from backend API
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


  //form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError("");

    try {
      const endpoint =
        activeCategory === "Rooms" ? "/api/rooms" : "/api/resources";

      const body =
        activeCategory === "Rooms" ? roomForm : itemForm;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Parse error message and provide specific feedback
        const errorMessage = data.error || data.message || "Failed to add item";
        
        if (activeCategory === "Rooms") {
          if (errorMessage.includes("Cabin number already exists")) {
            setFormError(`Cabin number "${roomForm.cabin_number}" already exists. Please use a different cabin number.`);
          } else if (errorMessage.includes("Capacity must be greater than 1")) {
            setFormError("Capacity must be greater than 1 guest.");
          } else if (errorMessage.includes("cabin_number")) {
            setFormError("Please provide a valid cabin number.");
          } else {
            setFormError(errorMessage);
          }
        } else {
          if (errorMessage.includes("Resource name already exists")) {
            setFormError(`Resource name "${itemForm.name}" already exists. Please use a different name.`);
          } else if (errorMessage.includes("Quantity must be greater than 1")) {
            setFormError("Quantity must be greater than 1.");
          } else if (errorMessage.includes("name")) {
            setFormError("Please provide a valid resource name.");
          } else if (errorMessage.includes("quantity")) {
            setFormError("Please provide a valid quantity.");
          } else {
            setFormError(errorMessage);
          }
        }
        return;
      }

      //refresh inventory
      const roomsData = await fetchData("/api/rooms");
      const itemsData = await fetchData("/api/resources");

      setInventoryData({
        Rooms: roomsData,
        Items: itemsData,
      });

      setFormError("");
      setShowModal(false);
    } catch (error) {
      console.error("Failed to add inventory item:", error);
      setFormError("An error occurred. Please try again.");
    }
  };

  //handle delete submission
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

      //refresh inventory
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

        {/*Buttons to switch categories */}
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

        {/*Add/Delete buttons */}
        <button className="addButton" onClick={() => setShowModal(true)}>
          Add {activeCategory.slice(0, -1)}
        </button>
        <button className="deleteButton" onClick={() => setShowDeleteModal(true)}>Delete {activeCategory.slice(0, -1)}</button>

        {/*changes table dynamically */}
        <table className="inventoryTable">
          <thead>
            {activeCategory === "Rooms" ? (
              <tr>
                <th>Cabin</th>
                <th>Deck</th>
                <th>Status</th>
              </tr>
            ) : (
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Status</th>
              </tr>
            )}
          </thead>

          <tbody>
            {inventoryData[activeCategory].map((item) =>
              activeCategory === "Rooms" ? (
                <tr key={item.id}>
                  <td>{item.cabin_number}</td>
                  <td>{item.deck}</td>
                  <td>{item.status}</td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.quantity}</td>
                  <td>{item.status}</td>
                </tr>
              )
            )}
          </tbody>
        </table>

      </main>
      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>

      {/*modal for adding rooms/items */}
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
                      <option value="Unavailable">Unavailable</option>
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

              {formError && (
                <div className="errorMessage">
                  {formError}
                </div>
              )}

              <button type="submit" onClick={() => {setFormError("");}} className="submitButton">Submit</button>
              <button type="button" onClick={() => { setShowModal(false); setFormError("");}} className="cancelButton">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/*modal for deleting rooms/items */}
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
