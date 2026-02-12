import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
import DateTimePicker from "react-datetime-picker";
import "react-datetime-picker/dist/DateTimePicker.css";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";

const API_URL = import.meta.env.VITE_API_URL;

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export default function Reservation() {
  const shipName = "Starlight Pearl Cruises";

  const [formError, setFormError] = useState<string>("");

  const categories = ["Items", "Packages"] as const;

  //current selected tab/category
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");
  
  //available items from database
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  //reservation form state for Items tab
  const [itemReservationForm, setItemReservationForm] = useState({
    itemId: "",
    quantity: "",
  });

  //dateTime picker state
  const [startDateTime, setStartDateTime] = useState<Value>(new Date());
  const [endDateTime, setEndDateTime] = useState<Value>(new Date());

  //package reservation form state
  const [packageReservationForm, setPackageReservationForm] = useState({
    packageId: "",
  });

  //fetch available items from backend API
  useEffect(() => {
    const loadAvailableItems = async () => {
      try {
        const itemsData = await fetchData("/api/resources");
        //shows only currently available items from database
        const available = itemsData.filter((item: any) => item.status === "Available");
        setAvailableItems(available);
      } catch (error) {
        console.error("Error fetching available items:", error);
      }
    };

    loadAvailableItems();
  }, []);

  //real-time validation: check if quantity entered exceeds available amount for selected item
  useEffect(() => {
    let errorMessage = "";
    
    if (itemReservationForm.itemId && itemReservationForm.quantity) {
      const selectedItem = availableItems.find((item) => String(item.id) === String(itemReservationForm.itemId));
      console.log("Selected Item:", selectedItem);
      console.log("Entered Quantity:", itemReservationForm.quantity);
      console.log("Available Quantity:", selectedItem?.quantity);
      
      if (selectedItem) {
        const quantity = parseInt(itemReservationForm.quantity);
        console.log("Parsed Quantity:", quantity, "Type:", typeof quantity);
        console.log("Selected Item Quantity:", selectedItem.quantity, "Type:", typeof selectedItem.quantity);
        console.log("Comparison Result:", quantity > selectedItem.quantity);
        
        if (!isNaN(quantity) && quantity > selectedItem.quantity) {
          errorMessage = `Quantity exceeds available amount. Available: ${selectedItem.quantity}`;
        }
      }
    }
    
    setFormError(errorMessage);
  }, [itemReservationForm, availableItems]);

  //reservation submission
  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError("");

    if (activeCategory === "Items") {
      //validate item selection
      if (!itemReservationForm.itemId) {
        setFormError("Please select an item to reserve.");
        return;
      }

      //validate quantity entered is a positive integer
      const quantity = parseInt(itemReservationForm.quantity);
      if (isNaN(quantity) || quantity < 1) {
        setFormError("Please enter a valid quantity (minimum 1).");
        return;
      }

      //validate quantity does not exceed available amount
      const selectedItem = availableItems.find((item) => String(item.id) === String(itemReservationForm.itemId));
      if (selectedItem && quantity > selectedItem.quantity) {
        setFormError(`Quantity exceeds available amount. Available: ${selectedItem.quantity}`);
        return;
      }

      //validate start date/time selected
      if (!startDateTime) {
        setFormError("Please select a start date and time for the reservation.");
        return;
      }

      //validate end date/time selected
      if (!endDateTime) {
        setFormError("Please select an end date and time for the reservation.");
        return;
      }

      //validate end date is after start date
      if (endDateTime <= startDateTime) {
        setFormError("End date/time must be after start date/time.");
        return;
      }

      try {
        // TODO: Replace with actual reservation API endpoint when available
        const reservationData = {
          itemId: itemReservationForm.itemId,
          quantity: quantity,
          startDateTime: startDateTime,
          endDateTime: endDateTime,
        };

        console.log("Reservation Data:", reservationData);
        
        // Placeholder for actual API call
        // const response = await fetch(`${API_URL}/api/reservations`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(reservationData),
        // });

        alert("Reservation submitted successfully! (API endpoint not yet implemented)");
        
        // Reset form
        setItemReservationForm({ itemId: "", quantity: "" });
        setStartDateTime(new Date());
        setEndDateTime(new Date());
      } 
      catch (error) {
        console.error("Failed to create reservation:", error);
        setFormError("An error occurred. Please try again.");
      }
    } else {
      // Packages tab - placeholder for future implementation
      setFormError("Package reservations are not yet implemented.");
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

      <main className="container section centerCard">
        <h2>Make a Reservation</h2>

        {/*buttons to switch tabs */}
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

        {/*reservation form */}
        <div className="reservationForm">
          <form onSubmit={handleReservationSubmit}>
            {activeCategory === "Items" ? (
              <>
                <label>
                  Select Item:
                  <select
                    className="itemInput"
                    value={itemReservationForm.itemId}
                    onChange={(e) => setItemReservationForm({...itemReservationForm, itemId: e.target.value})}
                    required
                  >
                    <option value="">-- Choose an item --</option>
                    {availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) - Available: {item.quantity}
                      </option>
                    ))}
                  </select>
                </label>

                <br />
                
                <label>
                  Quantity:
                  <input
                    className="quantityInput"
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={itemReservationForm.quantity}
                    onChange={(e) => setItemReservationForm({...itemReservationForm, quantity: e.target.value})}
                    required
                  />
                </label>

                <br />

                <label>
                  Start Date & Time:
                  <DateTimePicker
                    onChange={setStartDateTime}
                    value={startDateTime}
                    minDate={new Date()}
                    format="y-MM-dd h:mm a"
                    required/>
                </label>

                <br />

                <label>
                  End Date & Time:
                  <DateTimePicker
                    onChange={setEndDateTime}
                    value={endDateTime}
                    minDate={startDateTime as Date || new Date()}
                    format="y-MM-dd h:mm a"
                    required/>
                </label>
              </>
            ) : (
              // Packages tab - placeholder
              <div className="packagesPlaceholder">
                <p>Package reservations coming soon!</p>
              </div>
            )}

            {formError && (
              <div className="errorMessage">
                {formError}
              </div>
            )}

            {activeCategory === "Items" && (
              <button type="submit" className="submitButton">
                Submit Reservation
              </button>
            )}
          </form>
        </div>
      </main>
      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
