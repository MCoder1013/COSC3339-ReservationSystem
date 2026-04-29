/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import { Link } from "react-router-dom";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { formatInTimeZone } from 'date-fns-tz';
import NavBar from "./NavBar";
import PackageEventsTab from './PackageEventsTab';
import { useAuth } from './AuthContext';
import { validatePaymentForm as validatePaymentFormFields } from "./paymentValidation";

const API_URL = import.meta.env.VITE_API_URL;

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type CruiseOption = {
  id: string;
  name: string;
};

const RESERVATION_CRUISE_MAP_KEY = "reservationCruiseMapV1";

export default function Reservation() {
  const { user } = useAuth();
  const shipName = "Starlight Pearl Cruises";



  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");
  const [currentAvailability, setCurrentAvailability] = useState<number | null>(null);
  const categories = ["Items", "Rooms", "Packages"] as const;
  const [cruises, setCruises] = useState<CruiseOption[]>([]);
  const [accessibleCruises, setAccessibleCruises] = useState<CruiseOption[]>([]);
  const [selectedCruiseId, setSelectedCruiseId] = useState<string>("");
  const [isCruiseLoading, setIsCruiseLoading] = useState<boolean>(true);
  const isCruiseSelected = selectedCruiseId !== "";
  const normalizedRole = String(user?.role ?? "").toLowerCase();
  const hideRoomsTab = normalizedRole === "staff" || normalizedRole === "admin" || String(user?.staffRole ?? "").toLowerCase() === "admin";

  // current selected tab/category
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Rooms");
  const cruiseOptions = activeCategory === "Rooms" ? cruises : accessibleCruises;
  
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    cardHolderName: "",
    cardNumber: "",
    expirationDate: "",
    securityCode: "",
    zipCode: "",
  });


  const timeSelected =
    itemStartDate &&
    itemStartTime &&
    itemEndDate &&
    itemEndTime;

  const saveReservationCruiseMapping = (reservationId: number | string, cruiseId: string) => {
    const id = String(reservationId);
    if (!id || !cruiseId) return;

    try {
      const raw = localStorage.getItem(RESERVATION_CRUISE_MAP_KEY);
      const previous = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      const next = {
        ...previous,
        [id]: cruiseId,
      };

      localStorage.setItem(RESERVATION_CRUISE_MAP_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("Error saving reservation cruise mapping:", error);
    }
  };

  const normalizeCruiseIdForPayload = (cruiseId: string) => {
    const numericId = Number(cruiseId);
    return Number.isNaN(numericId) ? cruiseId : numericId;
  };

  const isUpcomingCruise = (cruise: any) => {
    const rawReturnDate = cruise?.return_date ?? cruise?.returnDate;
    if (!rawReturnDate) return true;

    const returnDate = new Date(rawReturnDate);
    if (Number.isNaN(returnDate.getTime())) return true;

    returnDate.setHours(23, 59, 59, 999);
    return returnDate >= new Date();
  };

  const loadCruises = async () => {
    setIsCruiseLoading(true);
    try {
      const [cruiseData, eligibleCruiseData] = await Promise.all([
        fetchData("/api/cruises"),
        fetchData("/api/reservations/eligible-cruises"),
      ]);

      function normalizeCruise(cruise: any) {
        return {
          id: cruise.id,
          name: `${cruise.ship_name} - ${cruise.cruise_name}`
        };
      }

      const normalized = cruiseData
        .filter(isUpcomingCruise)
        .map(normalizeCruise);
      const normalizedEligible = eligibleCruiseData
        .filter(isUpcomingCruise)
        .map(normalizeCruise);

      setCruises(normalized);
      setAccessibleCruises(normalizedEligible);
    } catch (error) {
      console.log(error);
      setCruises([]);
      setAccessibleCruises([]);
    } finally {
      setIsCruiseLoading(false);
    }
  };

  useEffect(() => {
    loadCruises();
  }, []);

  useEffect(() => {
    if (hideRoomsTab) {
      if (activeCategory === "Rooms") {
        setActiveCategory("Items");
      }
      return;
    }

    if (accessibleCruises.length === 0 && activeCategory !== "Rooms") {
      setActiveCategory("Rooms");
    }
  }, [accessibleCruises.length, activeCategory, hideRoomsTab]);

  useEffect(() => {
    const allowedIds = new Set(cruiseOptions.map((cruise) => cruise.id.toString()));
    if (selectedCruiseId && !allowedIds.has(selectedCruiseId)) {
      setSelectedCruiseId("");
      console.log('Unset cruise id', selectedCruiseId, "because it's not in allowedIds:", allowedIds)
    }
  }, [cruiseOptions, selectedCruiseId]);

  //date and time picker state for Rooms
  const [roomStartDate, setRoomStartDate] = useState<ValuePiece>(new Date());
  const [roomStartTime, setRoomStartTime] = useState("");
  const [roomEndDate, setRoomEndDate] = useState<ValuePiece>(new Date());
  const [roomEndTime, setRoomEndTime] = useState("");
  const [availableRoomStartTimes, setAvailableRoomStartTimes] = useState<string[]>([]);
  const [availableRoomEndTimes, setAvailableRoomEndTimes] = useState<string[]>([]);

  //additional guest emails for room reservations
  const [additionalGuestEmails, setAdditionalGuestEmails] = useState<string[]>([]);
  const [guestEmailError, setGuestEmailError] = useState<string>("");

  // Handler functions for managing additional guest emails
  const handleAddGuestEmail = () => {
    setGuestEmailError("");

    if (!roomReservationForm.cabinId) {
      setGuestEmailError("Please select a room first.");
      return;
    }

    const selectedRoom = availableRooms.find((room) => String(room.id) === String(roomReservationForm.cabinId));
    if (!selectedRoom) {
      setGuestEmailError("Selected room not found.");
      return;
    }

    const roomCapacity = selectedRoom.capacity;
    const currentGuestCount = additionalGuestEmails.length + 1; // +1 for the primary user

    if (currentGuestCount >= roomCapacity) {
      setGuestEmailError(`Cannot add more guests. Room capacity is ${roomCapacity}.`);
      return;
    }

    setAdditionalGuestEmails([...additionalGuestEmails, ""]);
  };

  const handleRemoveGuestEmail = (index: number) => {
    setGuestEmailError("");
    const updatedEmails = additionalGuestEmails.filter((_, i) => i !== index);
    setAdditionalGuestEmails(updatedEmails);
  };

  const handleUpdateGuestEmail = (index: number, value: string) => {
    const updatedEmails = [...additionalGuestEmails];
    updatedEmails[index] = value;
    setAdditionalGuestEmails(updatedEmails);
  };

  function formatTimeLabel(timeStr: string) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  function combineDateAndTime(date: Date, timeStr: string) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }

    return slots;
  };

  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const getNextHalfHourMinutes = (date: Date) => {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    return Math.ceil(totalMinutes / 30) * 30;
  };

  const isSameCalendarDay = (firstDate: Date, secondDate: Date) => {
    return (
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate()
    );
  };

  const intervalsOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => {
    return startA < endB && startB < endA;
  };

  const getReservedItemQuantityAtMinute = (
    reservations: { startMinutes: number; endMinutes: number; quantityReserved: number }[],
    minute: number,
  ) => {
    return reservations
      .filter((reservation) => minute >= reservation.startMinutes && minute <= reservation.endMinutes)
      .reduce((sum, reservation) => sum + reservation.quantityReserved, 0);
  };

  const loadReservationWindows = async () => {
    const rows = await fetchData("/api/reservations");
    return Array.isArray(rows) ? rows : [];
  };

  const getItemReservationsForDay = async (itemId: string, date: Date) => {
    const reservations = await loadReservationWindows();
    return reservations
      .filter((reservation: any) => String(reservation.resource_id) === String(itemId))
      .filter((reservation: any) => reservation.status !== "Cancelled")
      .filter((reservation: any) => isSameCalendarDay(new Date(reservation.start_time), date))
      .map((reservation: any) => ({
        startMinutes: timeToMinutes(new Date(reservation.start_time).toTimeString().slice(0, 5)),
        endMinutes: timeToMinutes(new Date(reservation.end_time).toTimeString().slice(0, 5)),
        quantityReserved: Number(reservation.quantity_reserved) || 0,
      }));
  };

  const getItemReservations = async (itemId: string) => {
    const reservations = await loadReservationWindows();
    return reservations
      .filter((reservation: any) => String(reservation.resource_id) === String(itemId))
      .filter((reservation: any) => reservation.status !== "Cancelled")
      .map((reservation: any) => ({
        start: new Date(reservation.start_time),
        end: new Date(reservation.end_time),
        quantityReserved: Number(reservation.quantity_reserved) || 0,
      }));
  };

  const getRoomReservationsForDay = async (cabinId: string, date: Date) => {
    const reservations = await loadReservationWindows();
    return reservations
      .filter((reservation: any) => String(reservation.cabin_id) === String(cabinId))
      .filter((reservation: any) => reservation.status !== "Cancelled")
      .filter((reservation: any) => isSameCalendarDay(new Date(reservation.start_time), date))
      .map((reservation: any) => ({
        startMinutes: timeToMinutes(new Date(reservation.start_time).toTimeString().slice(0, 5)),
        endMinutes: timeToMinutes(new Date(reservation.end_time).toTimeString().slice(0, 5)),
      }));
  };

  const isRoomReservedAtMinute = (
    reservations: { startMinutes: number; endMinutes: number }[],
    minute: number,
  ) => {
    return reservations.some((reservation) => minute >= reservation.startMinutes && minute <= reservation.endMinutes);
  };

  const getRoomReservations = async (cabinId: string) => {
    const reservations = await loadReservationWindows();
    return reservations
      .filter((reservation: any) => String(reservation.cabin_id) === String(cabinId))
      .filter((reservation: any) => reservation.status !== "Cancelled")
      .map((reservation: any) => ({
        start: new Date(reservation.start_time),
        end: new Date(reservation.end_time),
      }));
  };

  const isItemIntervalAvailable = (
    reservations: { start: Date; end: Date; quantityReserved: number }[],
    requestedQuantity: number,
    totalQuantity: number,
    startDateTime: Date,
    endDateTime: Date
  ) => {
    for (let slotStart = new Date(startDateTime); slotStart < endDateTime; slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000)) {
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      const reservedQty = reservations
        .filter((res) => intervalsOverlap(slotStart, slotEnd, res.start, res.end))
        .reduce((sum, res) => sum + res.quantityReserved, 0);

      if (reservedQty + requestedQuantity > totalQuantity) {
        return false;
      }
    }

    return true;
  };

  const isRoomIntervalAvailable = (
    reservations: { start: Date; end: Date }[],
    startDateTime: Date,
    endDateTime: Date
  ) => {
    for (let slotStart = new Date(startDateTime); slotStart < endDateTime; slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000)) {
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
      if (reservations.some((res) => intervalsOverlap(slotStart, slotEnd, res.start, res.end))) {
        return false;
      }
    }

    return true;
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

      const dayReservations = await getItemReservationsForDay(itemId, date);

      // Get the selected item's total quantity
      const selectedItem = availableItems.find((item) => String(item.id) === itemId);
      const totalQuantity = selectedItem ? selectedItem.quantity : 0;

      // Generate all time slots
      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];
      const now = new Date();
      const minAllowedMinutes = isSameCalendarDay(date, now) ? getNextHalfHourMinutes(now) : 0;

      // For each start slot, capacity at that slot must support requested quantity
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        if (slotMinutes < minAllowedMinutes) continue;

        const reservedQtyAtSlot = getReservedItemQuantityAtMinute(dayReservations, slotMinutes);
        if (reservedQtyAtSlot + quantity_num <= totalQuantity) {
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
  const getAvailableItemEndTimes = async (itemId: string, quantity: string, startDate: Date, endDate: Date, startTime: string) => {
    if (!itemId || !quantity || !startDate || !endDate || !startTime) {
      setAvailableItemEndTimes([]);
      return;
    }

    try {
      const quantity_num = parseInt(quantity);
      if (isNaN(quantity_num) || quantity_num < 1) {
        setAvailableItemEndTimes([]);
        return;
      }

      const reservations = await getItemReservations(itemId);

      const selectedItem = availableItems.find((item) => String(item.id) === itemId);
      const totalQuantity = selectedItem ? selectedItem.quantity : 0;

      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];
      const now = new Date();
      const startDateTime = combineDateAndTime(startDate, startTime);

      // End time must be after start time and full interval must keep capacity-valid
      for (const timeSlot of allSlots) {
        const endDateTime = combineDateAndTime(endDate, timeSlot);
        if (endDateTime <= startDateTime || endDateTime <= now) continue;

        if (isItemIntervalAvailable(reservations, quantity_num, totalQuantity, startDateTime, endDateTime)) {
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
      const dayReservations = await getRoomReservationsForDay(cabinId, date);

      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];
      const now = new Date();
      const minAllowedMinutes = isSameCalendarDay(date, now) ? getNextHalfHourMinutes(now) : 0;

      // For each start slot, room must not already be reserved
      for (const timeSlot of allSlots) {
        const slotMinutes = timeToMinutes(timeSlot);
        if (slotMinutes < minAllowedMinutes) continue;

        if (!isRoomReservedAtMinute(dayReservations, slotMinutes)) {
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
  const getAvailableRoomEndTimes = async (cabinId: string, startDate: Date, endDate: Date, startTime: string) => {
    if (!cabinId || !startDate || !endDate || !startTime) {
      setAvailableRoomEndTimes([]);
      return;
    }

    try {
      const reservations = await getRoomReservations(cabinId);

      const allSlots = generateTimeSlots();
      const availableSlots: string[] = [];
      const now = new Date();
      const startDateTime = combineDateAndTime(startDate, startTime);

      // End time must be after start time and no overlap in the full interval
      for (const timeSlot of allSlots) {
        const endDateTime = combineDateAndTime(endDate, timeSlot);
        if (endDateTime <= startDateTime || endDateTime <= now) continue;

        if (isRoomIntervalAvailable(reservations, startDateTime, endDateTime)) {
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
    setFormSuccess("");
  }, [activeCategory]);

  useEffect(() => {
    if (formError) {
      setFormSuccess("");
    }
  }, [formError]);

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
      // Auto-sync end date to start date when start date changes
      setItemEndDate(itemStartDate);
    }
  }, [selectedCruiseId, itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, availableItems]);

  // Update available end times for items when start time changes
  useEffect(() => {
    if (activeCategory === "Items" && itemReservationForm.itemId && itemReservationForm.quantity && itemStartDate && itemEndDate && itemStartTime) {
      getAvailableItemEndTimes(itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, itemEndDate, itemStartTime);
      setItemEndTime("");
    }
  }, [selectedCruiseId, itemStartTime, itemEndDate, itemReservationForm.itemId, itemReservationForm.quantity, itemStartDate, availableItems]);

  // Update available start times for rooms when date or room changes
  useEffect(() => {
    if (activeCategory === "Rooms" && roomReservationForm.cabinId && roomStartDate) {
      getAvailableRoomStartTimes(roomReservationForm.cabinId, roomStartDate);
      setRoomStartTime("");
      setRoomEndTime("");
      setAvailableRoomEndTimes([]);
      // Auto-sync end date to start date when start date changes
      setRoomEndDate(roomStartDate);
      // Reset guest emails when room changes
      setAdditionalGuestEmails([]);
      setGuestEmailError("");
    }
  }, [selectedCruiseId, roomReservationForm.cabinId, roomStartDate, availableRooms]);

  // Update available end times for rooms when start time changes
  useEffect(() => {
    if (activeCategory === "Rooms" && roomReservationForm.cabinId && roomStartDate && roomEndDate && roomStartTime) {
      getAvailableRoomEndTimes(roomReservationForm.cabinId, roomStartDate, roomEndDate, roomStartTime);
      setRoomEndTime("");
    }
  }, [selectedCruiseId, roomStartTime, roomEndDate, roomReservationForm.cabinId, roomStartDate, availableRooms]);

  useEffect(() => {
    setFormError("");
    setCurrentAvailability(null);

    setItemReservationForm({ itemId: "", quantity: "" });
    setItemStartDate(new Date());
    setItemStartTime("");
    setItemEndDate(new Date());
    setItemEndTime("");
    setAvailableItemStartTimes([]);
    setAvailableItemEndTimes([]);

    setRoomReservationForm({ cabinId: "" });
    setRoomStartDate(new Date());
    setRoomStartTime("");
    setRoomEndDate(new Date());
    setRoomEndTime("");
    setAvailableRoomStartTimes([]);
    setAvailableRoomEndTimes([]);
    setAdditionalGuestEmails([]);
    setGuestEmailError("");
  }, [selectedCruiseId]);

  //reservation submission
  const resetPaymentForm = () => {
    setPaymentForm({
      cardHolderName: "",
      cardNumber: "",
      expirationDate: "",
      securityCode: "",
      zipCode: "",
    });
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentError("");
    setPaymentSuccess("");
    resetPaymentForm();
  };

  const validateReservationBeforePayment = (): string | null => {
    if (!selectedCruiseId) {
      return "Please select a cruise before making a reservation.";
    }

    if (!Number.isInteger(Number(selectedCruiseId))) {
      return "Please choose a valid cruise from the dropdown.";
    }

    if (activeCategory === "Items") {
      if (!itemReservationForm.itemId) {
        return "Please select an item to reserve.";
      }

      const quantity = parseInt(itemReservationForm.quantity);
      if (isNaN(quantity) || quantity < 1) {
        return "Please enter a valid quantity (minimum 1).";
      }

      const selectedItem = availableItems.find((item) => String(item.id) === String(itemReservationForm.itemId));
      if (selectedItem && quantity > selectedItem.quantity) {
        return `Quantity exceeds available amount. Available: ${selectedItem.quantity}`;
      }

      if (!itemStartDate) {
        return "Please select a start date for the reservation.";
      }

      if (!itemStartTime) {
        return "Please select a start time for the reservation.";
      }

      if (!itemEndDate) {
        return "Please select an end date for the reservation.";
      }

      if (!itemEndTime) {
        return "Please select an end time for the reservation.";
      }

      const startDateTime = combineDateAndTime(itemStartDate as Date, itemStartTime);
      const endDateTime = combineDateAndTime(itemEndDate as Date, itemEndTime);
      if (endDateTime <= startDateTime) {
        return "End date/time must be after start date/time.";
      }

      return null;
    }

    if (activeCategory === "Rooms") {
      if (!roomReservationForm.cabinId) {
        return "Please select a room to reserve.";
      }

      if (!roomStartDate) {
        return "Please select a check-in date.";
      }

      if (!roomStartTime) {
        return "Please select a check-in time.";
      }

      if (!roomEndDate) {
        return "Please select a check-out date.";
      }

      if (!roomEndTime) {
        return "Please select a check-out time.";
      }

      const startDateTime = combineDateAndTime(roomStartDate as Date, roomStartTime);
      const endDateTime = combineDateAndTime(roomEndDate as Date, roomEndTime);
      if (endDateTime <= startDateTime) {
        return "Check-out date/time must be after check-in date/time.";
      }

      for (let i = 0; i < additionalGuestEmails.length; i++) {
        const email = additionalGuestEmails[i].trim();
        if (email && !email.includes("@")) {
          return `Guest ${i + 1} email is invalid. Please enter a valid email address.`;
        }
      }

      return null;
    }

    return null;
  };

  type SubmitResult = { success: boolean; message?: string };

  const submitReservationRequest = async (): Promise<SubmitResult> => {
    setFormError("");
    setFormSuccess("");

    if (activeCategory === "Items") {
      const quantity = parseInt(itemReservationForm.quantity);
      const startDateTime = combineDateAndTime(itemStartDate as Date, itemStartTime);
      const endDateTime = combineDateAndTime(itemEndDate as Date, itemEndTime);

      try {
        const formatForMySQL = (date: Date) => {
          return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd HH:mm:ss');
        };

        const reservationData = {
          cruise_id: normalizeCruiseIdForPayload(selectedCruiseId),
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

        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
          console.error("Backend error:", responseData);
          const message = responseData?.error || `Failed to create reservation: ${response.status}`;
          setFormError(message);
          return { success: false, message };
        }

        if (responseData?.reservationId) {
          saveReservationCruiseMapping(responseData.reservationId, selectedCruiseId);
        }

        setFormSuccess("Item reservation submitted successfully.");
        setItemReservationForm({ itemId: "", quantity: "" });
        setItemStartDate(new Date());
        setItemStartTime("");
        setItemEndDate(new Date());
        setItemEndTime("");
        await loadAvailableItems();
        return { success: true };
      }
      catch (error) {
        console.error("Failed to create reservation:", error);
        const message = (error as any)?.message ?? "An error occurred. Please try again.";
        setFormError(message);
        return { success: false, message };
      }
    }

    if (activeCategory === "Rooms") {
      const startDateTime = combineDateAndTime(roomStartDate as Date, roomStartTime);
      const endDateTime = combineDateAndTime(roomEndDate as Date, roomEndTime);
      const validGuestEmails = additionalGuestEmails.filter(email => email.trim() !== "");

      try {
        const formatForMySQL = (date: Date) => {
          return formatInTimeZone(date, 'UTC', 'yyyy-MM-dd HH:mm:ss');
        };

        const reservationData = {
          cruise_id: normalizeCruiseIdForPayload(selectedCruiseId),
          cabin_id: Number(roomReservationForm.cabinId),
          start_time: formatForMySQL(startDateTime),
          end_time: formatForMySQL(endDateTime),
          quantity_reserved: 1,
          additional_guest_emails: validGuestEmails,
        };

        console.log(reservationData);

        const response = await fetch(`${API_URL}/api/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(reservationData),
        });

        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
          console.error("Backend error:", responseData);
          const message = responseData?.error || "Failed to create reservation";
          setFormError(message);
          return { success: false, message };
        }

        if (responseData?.reservationId) {
          saveReservationCruiseMapping(responseData.reservationId, selectedCruiseId);
        }

        setFormSuccess("Room reservation submitted successfully.");
        setRoomReservationForm({ cabinId: "" });
        setRoomStartDate(new Date());
        setRoomStartTime("");
        setRoomEndDate(new Date());
        setRoomEndTime("");
        setAdditionalGuestEmails([]);
        setGuestEmailError("");
        await loadAvailableRooms();
        await loadCruises();
        return { success: true };
      }
      catch (error: any) {
        console.error("Failed to create reservation:", error);
        const message = error?.message ?? 'An error occurred. Please try again.';
        setFormError(message);
        return { success: false, message };
      }
    }

    return { success: false, message: 'Unsupported reservation type' };
  };

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError("");
    setFormSuccess("");

    const reservationError = validateReservationBeforePayment();
    if (reservationError) {
      setFormError(reservationError);
      return;
    }

    setPaymentError("");
    setPaymentSuccess("");
    resetPaymentForm();
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {

    const paymentValidationError = validatePaymentFormFields(paymentForm);
    if (paymentValidationError) {
      setPaymentError(paymentValidationError);
      return;
    }

    const result = await submitReservationRequest();
    if (result.success) {
      setPaymentError("");
      setPaymentSuccess("Reservation made successfully.");
      return;
    }

    setPaymentError(result.message ?? "Unable to complete the reservation. Please try again.");
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section centerCard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2>Make a Reservation</h2>
          <Link to="/user-reservations">
            <button className="primaryButton">Back to My Reservations</button>
          </Link>
        </div>

        {/*buttons to switch tabs */}
        <div className="tabButtons">
          {!hideRoomsTab && (
            <button
              key="Rooms"
              onClick={() => setActiveCategory("Rooms")}
              className={activeCategory === "Rooms" ? "activeTab" : ""}
            >
              Rooms
            </button>
          )}

          {accessibleCruises.length > 0 && (
            <>
              <button
                key="Items"
                onClick={() => setActiveCategory("Items")}
                className={activeCategory === "Items" ? "activeTab" : ""}
              >
                Items
              </button>

              <button
                key="Packages"
                onClick={() => setActiveCategory("Packages")}
                className={activeCategory === "Packages" ? "activeTab" : ""}
              >
                Packages
              </button>
            </>
          )}
        </div>

        <br />

        {/*reservation form */}
        <div className="reservationForm">
          <form onSubmit={handleReservationSubmit}>
            <label>
              Select Cruise:
              <select
                className="itemInput"
                value={selectedCruiseId}
                onChange={(e) => setSelectedCruiseId(e.target.value)}
                required
                disabled={isCruiseLoading || cruiseOptions.length === 0}
              >
                <option value="">-- Choose a cruise --</option>
                {cruiseOptions.map((cruise) => (
                  <option key={cruise.id} value={cruise.id}>
                    {cruise.name}
                  </option>
                ))}
              </select>
            </label>

            {activeCategory === "Rooms" && !isCruiseLoading && cruiseOptions.length === 0 && (
              <div className="errorMessage" style={{ marginTop: "10px" }}>
                No currently available cruises can be booked right now.
              </div>
            )}

            {activeCategory !== "Rooms" && !isCruiseLoading && cruiseOptions.length === 0 && (
              <div className="errorMessage" style={{ marginTop: "10px" }}>
                You need a room reservation on a cruise before booking items there.
              </div>
            )}

            {!isCruiseSelected && (
              <div className="errorMessage" style={{ marginTop: "10px" }}>
                Choose a cruise to continue with this reservation.
              </div>
            )}

            <fieldset
              disabled={!isCruiseSelected}
              style={{ border: "none", padding: 0, margin: 0, minInlineSize: "auto" }}
            >
              {activeCategory === "Packages" ? (
                isCruiseSelected ? (
                  <PackageEventsTab cruiseId={selectedCruiseId} />
                ) : (
                  <div className="errorMessage" style={{ marginTop: "10px" }}>
                    Select a cruise to view available package events.
                  </div>
                )
              ) : activeCategory === "Items" ? (
                <>
                  <label>
                    Select Item:
                    <select
                      className="itemInput"
                      value={itemReservationForm.itemId}
                      onChange={(e) => setItemReservationForm({ ...itemReservationForm, itemId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose an item --</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.category}) - Available:{" "}
                          {item.id === Number(itemReservationForm.itemId) &&
                            timeSelected &&
                            currentAvailability !== null
                            ? currentAvailability
                            : item.quantity}
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
                      onChange={(e) => setItemReservationForm({ ...itemReservationForm, quantity: e.target.value })}
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
                          {formatTimeLabel(time)}
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
                          {formatTimeLabel(time)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Select Room:
                    <select
                      className="itemInput"
                      value={roomReservationForm.cabinId}
                      onChange={(e) => setRoomReservationForm({ ...roomReservationForm, cabinId: e.target.value })}
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
                          {formatTimeLabel(time)}
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
                          {formatTimeLabel(time)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <br />

                  {/* Additional Guests Section */}
                  <div className="additionalGuestsSection">
                    <h4>Additional Guests</h4>
                    <p className="additionalGuestsInfo">
                      {roomReservationForm.cabinId && availableRooms.find(r => String(r.id) === String(roomReservationForm.cabinId))
                        ? `Room capacity: ${availableRooms.find(r => String(r.id) === String(roomReservationForm.cabinId)).capacity} (You can add ${availableRooms.find(r => String(r.id) === String(roomReservationForm.cabinId)).capacity - 1} more guest${availableRooms.find(r => String(r.id) === String(roomReservationForm.cabinId)).capacity - 1 !== 1 ? 's' : ''})`
                        : "Select a room to add additional guests"}
                    </p>

                    {additionalGuestEmails.map((email, index) => (
                      <div key={index} className="guestEmailRow">
                        <label>
                          Guest {index + 1} Email:
                          <input
                            type="email"
                            className="quantityInput"
                            placeholder="Enter guest email"
                            value={email}
                            onChange={(e) => handleUpdateGuestEmail(index, e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuestEmail(index)}
                          className="removeGuestButton"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddGuestEmail}
                      className="addGuestButton"
                    >
                      + Add Guest Email
                    </button>

                    {guestEmailError && (
                      <div className="guestEmailError">
                        {guestEmailError}
                      </div>
                    )}
                  </div>
                </>
              )}

              {formError && (
                <div className="errorMessage">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div
                  className="errorMessage"
                  style={{
                    backgroundColor: "rgba(36, 128, 52, 0.18)",
                    color: "#0e4a1a",
                    border: "1px solid rgba(36, 128, 52, 0.4)",
                  }}
                >
                  {formSuccess}
                </div>
              )}

              {activeCategory !== "Packages" && (
                <button type="submit" className="submitButton">
                  Continue to Payment
                </button>
              )}
            </fieldset>
          </form>
        </div>
      </main>

      {isPaymentModalOpen && (
        <div className="paymentModalOverlay">
          <div className="paymentModalContent">
            <div className="paymentModalHeader">
              <div>
                <h3>Secure Payment</h3>
              </div>
              <button type="button" className="paymentModalCloseButton" onClick={closePaymentModal}>
                ✕
              </button>
            </div>

            <div className="paymentForm">
              {paymentSuccess && (
                <div
                  style={{
                    backgroundColor: "rgba(36, 128, 52, 0.18)",
                    color: "#0e4a1a",
                    border: "1px solid rgba(36, 128, 52, 0.4)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    marginBottom: "10px",
                  }}
                >
                  {paymentSuccess}
                </div>
              )}

              <div className="paymentFormGrid">
                <label className="paymentField paymentFieldFull">
                  Card Holder's Name
                  <input
                    type="text"
                    autoComplete="cc-name"
                    value={paymentForm.cardHolderName}
                    onChange={(event) => {
                      setPaymentError("");
                      setPaymentSuccess("");
                      setPaymentForm({ ...paymentForm, cardHolderName: event.target.value });
                    }}
                    placeholder="Name as shown on card"
                  />
                </label>

                <label className="paymentField paymentFieldFull">
                  Card Number
                  <input
                    type="text"
                    autoComplete="cc-number"
                    inputMode="numeric"
                    maxLength={19}
                    value={paymentForm.cardNumber}
                    onChange={(event) => {
                      setPaymentError("");
                      setPaymentSuccess("");
                      const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = digitsOnly.replace(/(.{4})/g, "$1 ").trim();
                      setPaymentForm({ ...paymentForm, cardNumber: formatted });
                    }}
                    placeholder="1234 5678 9012 3456"
                  />
                </label>

                <label className="paymentField">
                  Expiration Date
                  <input
                    type="text"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    placeholder="12/28"
                    maxLength={5}
                    value={paymentForm.expirationDate}
                    onChange={(event) => {
                      setPaymentError("");
                      setPaymentSuccess("");
                      const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 4);
                      const formatted = digitsOnly.length > 2 ? `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}` : digitsOnly;
                      setPaymentForm({ ...paymentForm, expirationDate: formatted });
                    }}
                  />
                  <span className="paymentFieldHint">Use MM/YY format, for example 12/28.</span>
                </label>

                <label className="paymentField">
                  Security Code
                  <input
                    type="text"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    maxLength={3}
                    value={paymentForm.securityCode}
                    onChange={(event) => {
                      setPaymentError("");
                      setPaymentSuccess("");
                      const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 3);
                      setPaymentForm({ ...paymentForm, securityCode: digitsOnly });
                    }}
                    placeholder="123"
                  />
                </label>

                <label className="paymentField paymentFieldFull">
                  Zip Code
                  <input
                    type="text"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={5}
                    value={paymentForm.zipCode}
                    onChange={(event) => {
                      setPaymentError("");
                      setPaymentSuccess("");
                      const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 5);
                      setPaymentForm({ ...paymentForm, zipCode: digitsOnly });
                    }}
                    placeholder="12345"
                  />
                </label>
              </div>

              {paymentError && <div className="paymentError">{paymentError}</div>}

              <div className="paymentActions">
                <button type="button" className="paymentSecondaryButton" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button type="button" className="paymentPrimaryButton" onClick={() => void handlePaymentSubmit()}>
                  Submit / Reserve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}