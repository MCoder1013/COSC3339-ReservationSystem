/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { formatInTimeZone } from 'date-fns-tz';
import NavBar from "./NavBar";

const API_URL = import.meta.env.VITE_API_URL;

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

export default function Reservation() {
  const shipName = "Starlight Pearl Cruises";

  const [formError, setFormError] = useState<string>("");

  const categories = ["Items", "Rooms", "Packages"] as const;

  //current selected tab/category
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");
  
  //available items from database
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  
  //available rooms from database
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  //reservation form state for Items tab
  const [itemReservationForm, setItemReservationForm] = useState({
    itemId: "",
    quantity: "",
  });
  
  //reservation form state for Rooms tab
  const [roomReservationForm, setRoomReservationForm] = useState({
    cabinId: "",
  });

  //date and time picker state for Items
  const [itemStartDate, setItemStartDate] = useState<ValuePiece>(new Date());
  const [itemStartTime, setItemStartTime] = useState("");
  const [itemEndDate, setItemEndDate] = useState<ValuePiece>(new Date());
  const [itemEndTime, setItemEndTime] = useState("");
  const [availableItemStartTimes, setAvailableItemStartTimes] = useState<string[]>([]);
  const [availableItemEndTimes, setAvailableItemEndTimes] = useState<string[]>([]);

  //date and time picker state for Rooms
  const [roomStartDate, setRoomStartDate] = useState<ValuePiece>(new Date());
  const [roomStartTime, setRoomStartTime] = useState("");
  const [roomEndDate, setRoomEndDate] = useState<ValuePiece>(new Date());
  const [roomEndTime, setRoomEndTime] = useState("");
  const [availableRoomStartTimes, setAvailableRoomStartTimes] = useState<string[]>([]);
  const [availableRoomEndTimes, setAvailableRoomEndTimes] = useState<string[]>([]);

  // Generate all 30-minute time slots for a day
  const generateTimeSlots = (): string[] => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  // Convert time string (HH:mm) to minutes for comparison
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Format datetime from date and time string
  const combineDateAndTime = (date: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  };

  // Fetch existing reservations for an item on a specific date and calculate available start times
  const getAvailableItemStartTimes = async (itemId: string, quantity: string, date: Date) => {
    if (!itemId || !quantity || !date) {
      setAvailableItemStartTimes([]);
      return;
    }

    try {
      const quantity_num = parseInt(quantity);
      if (isNaN(quantity_num) || quantity_num < 1) {
        setAvailableItemStartTimes([]);
        return;
      }

      // Fetch all reservations for this item
      const allReservations = await fetchData(`/api/reservations?resource_id=${itemId}`);
      
      // Filter reservations for the selected date
      const dateStr = date.toISOString().split("T")[0];
      const dayReservations = allReservations.filter((res: any) => {
        const resStartDate = new Date(res.start_time).toISOString().split("T")[0];
        return resStartDate === dateStr && res.resource_id === Number(itemId);
      });

      // Get the selected item's total quantity
      const selectedItem = availableItems.find((item) => String(item.id) === itemId);
      const totalQuantity = selectedItem ? selectedItem.quantity : 0;

      // Generate all time slots
      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];

      // For each time slot, check if quantity is available
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        let isAvailable = true;

        // Check against all existing reservations
        for (const res of dayReservations) {
          const resStartTime = new Date(res.start_time);
          const resEndTime = new Date(res.end_time);
          const resStartMinutes = resStartTime.getHours() * 60 + resStartTime.getMinutes();
          const resEndMinutes = resEndTime.getHours() * 60 + resEndTime.getMinutes();

          // Check if there's an overlap at this time slot
          if (slotMinutes >= resStartMinutes && slotMinutes < resEndMinutes) {
            // There's an overlap - check if enough quantity is available
            const totalReservedAtThisTime = dayReservations
              .filter((r: any) => {
                const rStartMin = new Date(r.start_time).getHours() * 60 + new Date(r.start_time).getMinutes();
                const rEndMin = new Date(r.end_time).getHours() * 60 + new Date(r.end_time).getMinutes();
                return slotMinutes >= rStartMin && slotMinutes < rEndMin;
              })
              .reduce((sum: number, r: any) => sum + r.quantity_reserved, 0);

            if (totalReservedAtThisTime + quantity_num > totalQuantity) {
              isAvailable = false;
              break;
            }
          }
        }

        if (isAvailable) {
          availableSlots.push(timeSlot);
        }
      }

      setAvailableItemStartTimes(availableSlots);
    } catch (error) {
      console.error("Error fetching available times:", error);
      setAvailableItemStartTimes([]);
    }
  };

  // Calculate available end times based on start time
  const getAvailableItemEndTimes = async (itemId: string, quantity: string, date: Date, startTime: string) => {
    if (!itemId || !quantity || !date || !startTime) {
      setAvailableItemEndTimes([]);
      return;
    }

    try {
      const quantity_num = parseInt(quantity);
      if (isNaN(quantity_num) || quantity_num < 1) {
        setAvailableItemEndTimes([]);
        return;
      }

      // Fetch all reservations for this item
      const allReservations = await fetchData(`/api/reservations?resource_id=${itemId}`);
      
      const dateStr = date.toISOString().split("T")[0];
      const dayReservations = allReservations.filter((res: any) => {
        const resStartDate = new Date(res.start_time).toISOString().split("T")[0];
        return resStartDate === dateStr && res.resource_id === Number(itemId);
      });

      const selectedItem = availableItems.find((item) => String(item.id) === itemId);
      const totalQuantity = selectedItem ? selectedItem.quantity : 0;

      const allSlots = generateTimeSlots();
      const startTimeMinutes = timeToMinutes(startTime);
      const availableSlots: string[] = [];

      // End time must be after start time
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        if (slotMinutes <= startTimeMinutes) continue;

        let isAvailable = true;

         // Check against all existing reservations
        for (const res of dayReservations) {
          const resEndTime = new Date(res.end_time);
          const resEndMinutes = resEndTime.getHours() * 60 + resEndTime.getMinutes();

          // Check if there's an overlap from startTime to this timeSlot
          if (slotMinutes <= resEndMinutes && startTimeMinutes < resEndMinutes) {
            const totalReservedInRange = dayReservations
              .filter((r: any) => {
                const rStartMin = new Date(r.start_time).getHours() * 60 + new Date(r.start_time).getMinutes();
                const rEndMin = new Date(r.end_time).getHours() * 60 + new Date(r.end_time).getMinutes();
                return !(rEndMin <= startTimeMinutes || rStartMin >= slotMinutes);
              })
              .reduce((sum: number, r: any) => sum + r.quantity_reserved, 0);

            if (totalReservedInRange + quantity_num > totalQuantity) {
              isAvailable = false;
              break;
            }
          }
        }

        if (isAvailable) {
          availableSlots.push(timeSlot);
        }
      }

      setAvailableItemEndTimes(availableSlots);
    } catch (error) {
      console.error("Error fetching available end times:", error);
      setAvailableItemEndTimes([]);
    }
  };

  // Fetch existing reservations for a room on a specific date and calculate available start times
  const getAvailableRoomStartTimes = async (cabinId: string, date: Date) => {
    if (!cabinId || !date) {
      setAvailableRoomStartTimes([]);
      return;
    }

    try {
      // Fetch all reservations for this room
      const allReservations = await fetchData(`/api/reservations?cabin_id=${cabinId}`);
      
      const dateStr = date.toISOString().split("T")[0];
      const dayReservations = allReservations.filter((res: any) => {
        const resStartDate = new Date(res.start_time).toISOString().split("T")[0];
        return resStartDate === dateStr && res.cabin_id === Number(cabinId);
      });

      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];

      // For each time slot, check if room is available
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        let isAvailable = true;

        // Check against all existing reservations
        for (const res of dayReservations) {
          const resStartTime = new Date(res.start_time);
          const resEndTime = new Date(res.end_time);
          const resStartMinutes = resStartTime.getHours() * 60 + resStartTime.getMinutes();
          const resEndMinutes = resEndTime.getHours() * 60 + resEndTime.getMinutes();

          // Check if there's an overlap at this time slot
          if (slotMinutes >= resStartMinutes && slotMinutes < resEndMinutes) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          availableSlots.push(timeSlot);
        }
      }

      setAvailableRoomStartTimes(availableSlots);
    } catch (error) {
      console.error("Error fetching available times:", error);
      setAvailableRoomStartTimes([]);
    }
  };

  // Calculate available end times for rooms based on start time
  const getAvailableRoomEndTimes = async (cabinId: string, date: Date, startTime: string) => {
    if (!cabinId || !date || !startTime) {
      setAvailableRoomEndTimes([]);
      return;
    }

    try {
      const allReservations = await fetchData(`/api/reservations?cabin_id=${cabinId}`);
      
      const dateStr = date.toISOString().split("T")[0];
      const dayReservations = allReservations.filter((res: any) => {
        const resStartDate = new Date(res.start_time).toISOString().split("T")[0];
        return resStartDate === dateStr && res.cabin_id === Number(cabinId);
      });

      const allSlots = generateTimeSlots();
      const startTimeMinutes = timeToMinutes(startTime);
      const availableSlots: string[] = [];

      // End time must be after start time
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        if (slotMinutes <= startTimeMinutes) continue;

        let isAvailable = true;

        // Check against all existing reservations
        for (const res of dayReservations) {
          const resEndTime = new Date(res.end_time);
          const resEndMinutes = resEndTime.getHours() * 60 + resEndTime.getMinutes();

          // Check if there's an overlap from startTime to this timeSlot
          if (slotMinutes <= resEndMinutes && startTimeMinutes < resEndMinutes) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          availableSlots.push(timeSlot);
        }
      }

      setAvailableRoomEndTimes(availableSlots);
    } catch (error) {
      console.error("Error fetching available end times:", error);
      setAvailableRoomEndTimes([]);
    }
  };

  // Fetch available items from backend API
  const loadAvailableItems = async () => {
    try {
      const itemsData = await fetchData("/api/resources");
      const available = itemsData.filter((item: any) => item.status === "Available");
      setAvailableItems(available);
    } catch (error) {
      console.error("Error fetching available items:", error);
    }
  };

  useEffect(() => {
    loadAvailableItems();
  }, []);

  useEffect(() => {
    setFormError("");
  }, [activeCategory]);

  // Fetch available rooms from backend API
  const loadAvailableRooms = async () => {
    try {
      const roomsData = await fetchData("/api/rooms");
      const available = roomsData.filter((room: any) => room.status === "Available");
      setAvailableRooms(available);
    } catch (error) {
      console.error("Error fetching available rooms:", error);
    }
  };

  useEffect(() => {
    loadAvailableRooms();
  }, []);

  // Real-time validation: check if quantity entered exceeds available amount for selected item
  useEffect(() => {
    let errorMessage = "";
    
    if (itemReservationForm.itemId && itemReservationForm.quantity) {
      const selectedItem = availableItems.find((item) => String(item.id) === String(itemReservationForm.itemId));
      if (selectedItem) {
        const quantity = parseInt(itemReservationForm.quantity);
        if (!isNaN(quantity) && quantity > selectedItem.quantity) {
          errorMessage = `Quantity exceeds available amount. Available: ${selectedItem.quantity}`;
        }
      }
    }
    
    setFormError(errorMessage);
  }, [itemReservationForm, availableItems]);

  // Update available start times for items when date, item, or quantity changes
  useEffect(() => {
    if (activeCategory === "Items" && itemReservationForm.itemId && itemReservationForm.quantity && itemStartDate) {
      getAvailableItemStartTimes(itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate);
      setItemStartTime("");
      setItemEndTime("");
      setAvailableItemEndTimes([]);
    }
  }, [itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, availableItems]);

  // Update available end times for items when start time changes
  useEffect(() => {
    if (activeCategory === "Items" && itemReservationForm.itemId && itemReservationForm.quantity && itemStartDate && itemStartTime) {
      getAvailableItemEndTimes(itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, itemStartTime);
      setItemEndTime("");
    }
  }, [itemStartTime, itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, availableItems]);

  // Update available start times for rooms when date or room changes
  useEffect(() => {
    if (activeCategory === "Rooms" && roomReservationForm.cabinId && roomStartDate) {
      getAvailableRoomStartTimes(roomReservationForm.cabinId, roomStartDate);
      setRoomStartTime("");
      setRoomEndTime("");
      setAvailableRoomEndTimes([]);
    }
  }, [roomReservationForm.cabinId, roomStartDate, availableRooms]);

  // Update available end times for rooms when start time changes
  useEffect(() => {
    if (activeCategory === "Rooms" && roomReservationForm.cabinId && roomStartDate && roomStartTime) {
      getAvailableRoomEndTimes(roomReservationForm.cabinId, roomStartDate, roomStartTime);
      setRoomEndTime("");
    }
  }, [roomStartTime, roomReservationForm.cabinId, roomStartDate, availableRooms]);

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

      //validate start date selected
      if (!itemStartDate) {
        setFormError("Please select a start date for the reservation.");
        return;
      }

      //validate start time selected
      if (!itemStartTime) {
        setFormError("Please select a start time for the reservation.");
        return;
      }

      //validate end date selected
      if (!itemEndDate) {
        setFormError("Please select an end date for the reservation.");
        return;
      }

      //validate end time selected
      if (!itemEndTime) {
        setFormError("Please select an end time for the reservation.");
        return;
      }

      //validate end date/time is after start date/time
      const startDateTime = combineDateAndTime(itemStartDate, itemStartTime);
      const endDateTime = combineDateAndTime(itemEndDate, itemEndTime);
      if (endDateTime <= startDateTime) {
        setFormError("End date/time must be after start date/time.");
        return;
      }

      try {
        const formatForMySQL = (date: Date) => {
          return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd HH:mm:ss');
        };

        const reservationData = {
          resource_id: Number(itemReservationForm.itemId),
          start_time: formatForMySQL(startDateTime),
          end_time: formatForMySQL(endDateTime),
          quantity_reserved: quantity,
        };
        console.log(reservationData)
        
        const response = await fetch(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(reservationData),
        });

        if (!response.ok) {
           const errorData = await response.json();
           console.error("Backend error:", errorData);
           throw new Error(`Failed to create reservation: ${response.status}`);
        }

        // Reset form
        setItemReservationForm({ itemId: "", quantity: "" });
        setItemStartDate(new Date());
        setItemStartTime("");
        setItemEndDate(new Date());
        setItemEndTime("");
        
        // Refresh available items to show updated quantities
        await loadAvailableItems();
      } 
      catch (error) {
        console.error("Failed to create reservation:", error);
        setFormError("An error occurred. Please try again.");
      }
    } else if (activeCategory === "Rooms") {
      //validate room selection
      if (!roomReservationForm.cabinId) {
        setFormError("Please select a room to reserve.");
        return;
      }

      //validate start date selected
      if (!roomStartDate) {
        setFormError("Please select a check-in date.");
        return;
      }

      //validate start time selected
      if (!roomStartTime) {
        setFormError("Please select a check-in time.");
        return;
      }

      //validate end date selected
      if (!roomEndDate) {
        setFormError("Please select a check-out date.");
        return;
      }

      //validate end time selected
      if (!roomEndTime) {
        setFormError("Please select a check-out time.");
        return;
      }

      //validate end date/time is after start date/time
      const startDateTime = combineDateAndTime(roomStartDate, roomStartTime);
      const endDateTime = combineDateAndTime(roomEndDate, roomEndTime);
      if (endDateTime <= startDateTime) {
        setFormError("Check-out date/time must be after check-in date/time.");
        return;
      }

      try {
        const formatForMySQL = (date: Date) => {
          return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd HH:mm:ss');
        };

        const reservationData = {
          cabin_id: Number(roomReservationForm.cabinId),
          start_time: formatForMySQL(startDateTime),
          end_time: formatForMySQL(endDateTime),
          quantity_reserved: 1,
        };

        console.log(reservationData);
        
        const response = await fetch(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(reservationData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Backend error:", errorData);
          throw new Error(errorData.error || "Failed to create reservation");
        }
        
        // Reset form
        setRoomReservationForm({ cabinId: "" });
        setRoomStartDate(new Date());
        setRoomStartTime("");
        setRoomEndDate(new Date());
        setRoomEndTime("");
        
        // Refresh available rooms to show updated availability
        await loadAvailableRooms();
      } 
      catch (error: any) {
        console.error("Failed to create reservation:", error);
        setFormError(error.message);
      }
    } else {
      // Packages tab - placeholder for future implementation
      setFormError("Package reservations are not yet implemented.");
    }
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

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
                  Start Date:
                  <DatePicker
                    onChange={(value: Value) => setItemStartDate(Array.isArray(value) ? value[0] : value)}
                    value={itemStartDate}
                    minDate={new Date()}
                    required
                  />
                </label>

                <br />

                <label>
                  Start Time:
                  <select
                    className="timeInput"
                    value={itemStartTime}
                    onChange={(e) => setItemStartTime(e.target.value)}
                    required
                    disabled={availableItemStartTimes.length === 0}
                  >
                    <option value="">-- Select start time --</option>
                    {availableItemStartTimes.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>

                <br />

                <label>
                  End Date:
                  <DatePicker
                    onChange={(value: Value) => setItemEndDate(Array.isArray(value) ? value[0] : value)}
                    value={itemEndDate}
                    minDate={itemStartDate || new Date()}
                    required
                  />
                </label>

                <br />

                <label>
                  End Time:
                  <select
                    className="timeInput"
                    value={itemEndTime}
                    onChange={(e) => setItemEndTime(e.target.value)}
                    required
                    disabled={availableItemEndTimes.length === 0}
                  >
                    <option value="">-- Select end time --</option>
                    {availableItemEndTimes.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : activeCategory === "Rooms" ? (
              <>
                <label>
                  Select Room:
                  <select
                    className="itemInput"
                    value={roomReservationForm.cabinId}
                    onChange={(e) => setRoomReservationForm({...roomReservationForm, cabinId: e.target.value})}
                    required
                  >
                    <option value="">-- Choose a room --</option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Cabin {room.cabin_number} - {room.type} - Deck {room.deck} - Capacity: {room.capacity}
                      </option>
                    ))}
                  </select>
                </label>

                <br />

                <label>
                  Check-In Date:
                  <DatePicker
                    onChange={(value: Value) => setRoomStartDate(Array.isArray(value) ? value[0] : value)}
                    value={roomStartDate}
                    minDate={new Date()}
                    required
                  />
                </label>

                <br />

                <label>
                  Check-In Time:
                  <select
                    className="timeInput"
                    value={roomStartTime}
                    onChange={(e) => setRoomStartTime(e.target.value)}
                    required
                    disabled={availableRoomStartTimes.length === 0}
                  >
                    <option value="">-- Select check-in time --</option>
                    {availableRoomStartTimes.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </label>

                <br />

                <label>
                  Check-Out Date:
                  <DatePicker
                    onChange={(value: Value) => setRoomEndDate(Array.isArray(value) ? value[0] : value)}
                    value={roomEndDate}
                    minDate={roomStartDate || new Date()}
                    required
                  />
                </label>

                <br />

                <label>
                  Check-Out Time:
                  <select
                    className="timeInput"
                    value={roomEndTime}
                    onChange={(e) => setRoomEndTime(e.target.value)}
                    required
                    disabled={availableRoomEndTimes.length === 0}
                  >
                    <option value="">-- Select check-out time --</option>
                    {availableRoomEndTimes.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
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

            {(activeCategory === "Items" || activeCategory === "Rooms") && (
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