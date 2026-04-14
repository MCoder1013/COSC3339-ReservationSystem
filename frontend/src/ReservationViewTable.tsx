/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import NavBar from "./NavBar";
import PackageEventsList from './PackageEventsList';
const API_URL = import.meta.env.VITE_API_URL;

export default function ReservationTable() {
  const shipName = "Starlight Pearl Cruises";
  const [formError, setFormError] = useState<string>("");

  // tabs
  const categories = ["Items", "Rooms", "Packages"] as const;
  const itemSubTabs = ["Individual", "Event"] as const;

  // current selected tab
  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");
  const [activeItemSubTab, setActiveItemSubTab] =
    useState<(typeof itemSubTabs)[number]>("Individual");

  const [reservationData, setReservationData] = useState<{
    Items: any[];
    Rooms: any[];
    Packages: any[];
  }>({
    Items: [],
    Rooms: [],
    Packages: [],
  });

  const [loading, setLoading] = useState(true);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReservationId, setCancelReservationId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Function to format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const allReservations = await fetchData("/api/reservations");

      const itemReservations = allReservations
        .filter(
          (res: any) => 
            res.resource_id !== null && 
            res.cabin_id === null
        )
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const roomReservations = allReservations
        .filter(
          (res: any) => 
            res.cabin_id !== null && 
            res.resource_id === null
        )
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      const packageReservations: any[] = [];

      setReservationData({
        Items: itemReservations,
        Rooms: roomReservations,
        Packages: packageReservations,
      });
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setFormError("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    if (activeCategory !== "Items") {
      setActiveItemSubTab("Individual");
    }
  }, [activeCategory]);

  const isEventItemReservation = (reservation: any) => {
    const reservationType = String(reservation?.reservation_type ?? "").toLowerCase();
    if (reservationType === "package_event_item") return true;

    // Package-event item rows use synthetic negative IDs in backend SQL.
    return Number(reservation?.id) < 0;
  };

  const getDisplayedReservations = () => {
    if (activeCategory !== "Items") {
      return reservationData[activeCategory];
    }

    if (activeItemSubTab === "Event") {
      return reservationData.Items.filter((reservation: any) => isEventItemReservation(reservation));
    }

    return reservationData.Items.filter((reservation: any) => !isEventItemReservation(reservation));
  };

  const displayedReservations = getDisplayedReservations();

  const validateCancellationReason = (value: string) => {
    const reason = value.trim();
    if (reason.length < 10) {
      return 'Please enter at least 10 characters for the cancellation reason.';
    }

    if (reason.length > 500) {
      return 'Cancellation reason must be 500 characters or less.';
    }

    const safeTextPattern = /^[A-Za-z0-9 ,.!?'"()\-:\n\r]+$/;
    if (!safeTextPattern.test(reason)) {
      return 'Use plain text only (letters, numbers, spaces, and common punctuation).';
    }

    return null;
  };

  const openCancelModal = (reservationId: number) => {
    setCancelReservationId(reservationId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReservationId(null);
    setCancelReason('');
  };

  const cancelReservation = async () => {
    if (cancelReservationId === null) return;

    setFormError('');

    const validationError = validateCancellationReason(cancelReason);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/reservations/${cancelReservationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to cancel reservation (Status: ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          console.log(jsonError);
        }
        throw new Error(errorMessage);
      }

      await loadReservations();
      closeCancelModal();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Could not cancel this reservation right now.');
    }
  };

  const handleDeleteReservation = (reservationId: number) => {
    openCancelModal(reservationId);
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section inventoryDisplay">
        <h2>Reservations</h2>

        {/* Buttons to switch categories */}
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

        {activeCategory === "Items" && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0", marginTop: "10px", marginBottom: "0" }}>
            {itemSubTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveItemSubTab(tab)}
                className={activeItemSubTab === tab ? "activeTab" : ""}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div style={{ height: "10px" }} />

        {formError && (
          <div className="errorMessage">{formError}</div>
        )}

        {activeCategory === "Packages" ? (
          <PackageEventsList showManagement={true} />
        ) : loading ? (
          <p>Loading reservations...</p>
        ) : displayedReservations.length === 0 ? (
          <p>
            {activeCategory === "Items"
              ? `No ${activeItemSubTab.toLowerCase()} item reservations found.`
              : `No ${activeCategory.toLowerCase()} reservations found.`}
          </p>
        ) : (
          /* Changes table dynamically */
          <table className="inventoryTable">
            <thead>
              {activeCategory === "Items" ? (
                <tr>
                  <th>{activeItemSubTab === "Event" ? "Event Item Ref" : "Reservation ID"}</th>
                  <th>Item Reserved</th>
                  <th>Quantity</th>
                  <th>User Email</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>{activeItemSubTab === "Event" ? "Event Name" : "Actions"}</th>
                </tr>
              ) : activeCategory === "Rooms" ? (
                <tr>
                  <th>Reservation ID</th>
                  <th>Cabin Number</th>
                  <th>User Email</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Reservation ID</th>
                  <th>Package Name</th>
                  <th>User Email</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>

            <tbody>
              {displayedReservations.map((reservation: any) =>
                activeCategory === "Items" ? (
                  <tr key={reservation.id}>
                    <td>
                      {activeItemSubTab === "Event"
                        ? (reservation.event_id && reservation.resource_id
                            ? `E${reservation.event_id}-R${reservation.resource_id}`
                            : reservation.id)
                        : reservation.id}
                    </td>
                    <td>{reservation.resource_name}</td>
                    <td>{reservation.quantity_reserved}</td>
                    <td>{reservation.email}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>
                      {activeItemSubTab === "Event" ? (
                        <span>
                          {reservation.event_name
                            ? reservation.event_name
                            : reservation.event_id
                              ? `Event #${reservation.event_id}`
                              : "Unknown Event"}
                        </span>
                      ) : isEventItemReservation(reservation) ? (
                        <span>N/A</span>
                      ) : (
                        <button
                          className="deleteButton"
                          onClick={() => handleDeleteReservation(reservation.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ) : activeCategory === "Rooms" ? (
                  <tr key={reservation.id}>
                    <td>{reservation.id}</td>
                    <td>{reservation.cabin_number}</td>
                    <td>{reservation.email}</td>
                    <td>{formatDateTime(reservation.start_time)}</td>
                    <td>{formatDateTime(reservation.end_time)}</td>
                    <td>
                      <button 
                        className="deleteButton"
                        onClick={() => handleDeleteReservation(reservation.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        )}

      {/* Cancellation modal */}
      {showCancelModal && cancelReservationId !== null && (
        <div className="modalOverlay" onClick={closeCancelModal}>
          <div
            className="modalContent packageEventModalContent"
            style={{ maxWidth: '560px', padding: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <h3 style={{ margin: 0 }}>Cancel Reservation</h3>
              <button className="modalCloseButton" onClick={closeCancelModal} aria-label="Close cancel reservation dialog">
                x
              </button>
            </div>

            <p style={{ marginBottom: '8px' }}>
              Enter a cancellation reason. This will be recorded with the cancellation.
            </p>

            <label htmlFor="cancel-reason-input" style={{ display: 'block', marginBottom: '6px' }}>
              Reason
            </label>
            <textarea
              id="cancel-reason-input"
              className="itemInput"
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Example: Guest requested cancellation due to schedule change."
            />
            <p style={{ marginTop: '6px', marginBottom: '0', fontSize: '0.9rem' }}>
              {cancelReason.trim().length}/500 characters
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button type="button" className="cancelButton" onClick={closeCancelModal}>
                Keep Reservation
              </button>
              <button type="button" className="submitButton" onClick={cancelReservation}>
                Submit Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}