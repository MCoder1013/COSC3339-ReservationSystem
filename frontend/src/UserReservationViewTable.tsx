/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import "./App.css";
import { Link } from "react-router-dom";
import { fetchData } from "./api";
import NavBar from "./NavBar";

const API_URL = import.meta.env.VITE_API_URL;

export default function ReservationTable() {
  const shipName = "Starlight Pearl Cruises";

  const [formError, setFormError] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [actionMode, setActionMode] = useState<"edit" | "delete" | null>(null);

  const [editData, setEditData] = useState<any>({});

  const categories = ["Items", "Rooms", "Packages"] as const;

  const [activeCategory, setActiveCategory] =
    useState<(typeof categories)[number]>("Items");

  const [reservationData, setReservationData] = useState<{
    Items: any[];
    Rooms: any[];
  }>({
    Items: [],
    Rooms: [],
  });

  const [loading, setLoading] = useState(true);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const toInputDateTime = (dateString: string) => {
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getNowForInput = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const roundTo30Minutes = (value: string) => {
    const date = new Date(value);

    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 30) * 30;

    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const loadReservations = async () => {
    setLoading(true);
    setFormError("");

    try {
      const allData = await fetchData("/api/my-reservations");
      const now = new Date();

      const itemsData = allData
        .filter(
          (res: any) =>
            res.resource_id !== null &&
            res.cabin_id === null &&
            new Date(res.end_time) >= now
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.start_time).getTime() -
            new Date(b.start_time).getTime()
        );

      const roomsData = allData
        .filter(
          (res: any) =>
            res.cabin_id !== null &&
            res.resource_id === null &&
            new Date(res.end_time) >= now
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.start_time).getTime() -
            new Date(b.start_time).getTime()
        );

      setReservationData({
        Items: itemsData,
        Rooms: roomsData,
      });

      setIsAuthenticated(true);
    } catch (error: any) {
      console.error(error);
      if (
        error.message.includes("401") ||
        error.message.includes("Not authenticated")
      ) {
        setFormError("Please sign in to view your reservations");
        setIsAuthenticated(false);
      } else {
        setFormError("Failed to load reservations");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleDeleteReservation = async (reservationId: number) => {
    try {
      const response = await fetch(
        `${API_URL}/api/reservations/${reservationId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete reservation");
      }

      await loadReservations();
      setSelectedReservationId(null);
      setActionMode(null);
    } catch (error) {
      console.error(error);
      setFormError("Failed to delete reservation.");
    }
  };

  const handleUpdateReservation = async () => {
    if (!selectedReservationId) return;

    const start = editData.start_time ? new Date(editData.start_time) : null;
    const end = editData.end_time ? new Date(editData.end_time) : null;
    const qty = editData.quantity_reserved;

    if (!start || isNaN(start.getTime())) {
      setFormError("Please enter a valid start date and time.");
      return;
    }
    if (!end || isNaN(end.getTime())) {
      setFormError("Please enter a valid end date and time.");
      return;
    }
    if (start <= new Date()) {
      setFormError("Start time must be in the future.");
      return;
    }
    if (end <= start) {
      setFormError("End time must be after start time.");
      return;
    }
    if (activeCategory === "Items" && (qty === undefined || !Number.isInteger(qty) || qty < 1)) {
      setFormError("Quantity must be a whole number of at least 1.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/reservations/${selectedReservationId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...editData,
            start_time: editData.start_time
              ? new Date(editData.start_time).toISOString()
              : undefined,
            end_time: editData.end_time
              ? new Date(editData.end_time).toISOString()
              : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update reservation");
      }

      await loadReservations();
      setSelectedReservationId(null);
      setActionMode(null);
      setEditData({});
    } catch (error) {
      console.error(error);
      setFormError("Failed to update reservation.");
    }
  };

  const startEditing = (reservation: any) => {
    setSelectedReservationId(reservation.id);
    setActionMode("edit");
    setEditData({
      start_time: toInputDateTime(reservation.start_time),
      end_time: toInputDateTime(reservation.end_time),
      quantity_reserved: reservation.quantity_reserved || 1,
    });
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section inventoryDisplay">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h2>My Reservations</h2>

          {isAuthenticated && (
            <Link to="/reservation">
              <button className="primaryButton">
                Make Reservation
              </button>
            </Link>
          )}
        </div>

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

        {formError && (
          <div className="errorMessage">{formError}</div>
        )}

        {activeCategory === "Packages" ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            Package Reservations Coming Soon!
          </div>
        ) : loading ? (
          <p>Loading...</p>
        ) : reservationData[activeCategory].length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            No reservations yet.
          </div>
        ) : (
          <table className="inventoryTable">
            <thead>
              {activeCategory === "Items" ? (
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Email</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>ID</th>
                  <th>Cabin</th>
                  <th>Email</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>

            <tbody>
              {reservationData[activeCategory].map((reservation) => (
                <>
                  <tr key={reservation.id}>
                    <td>{reservation.id}</td>

                    {activeCategory === "Items" ? (
                      <>
                        <td>{reservation.resource_name}</td>
                        <td>{reservation.quantity_reserved}</td>
                        <td>{reservation.email}</td>
                        <td>{formatDateTime(reservation.start_time)}</td>
                        <td>{formatDateTime(reservation.end_time)}</td>
                      </>
                    ) : (
                      <>
                        <td>{reservation.cabin_number}</td>
                        <td>{reservation.email}</td>
                        <td>{formatDateTime(reservation.start_time)}</td>
                        <td>{formatDateTime(reservation.end_time)}</td>
                      </>
                    )}

                    <td>
                      {selectedReservationId === reservation.id &&
                      actionMode !== "edit" ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="primaryButton"
                            onClick={() => startEditing(reservation)}
                          >
                            Edit
                          </button>

                          <button
                            className="deleteButton"
                            onClick={() =>
                              handleDeleteReservation(reservation.id)
                            }
                          >
                            Delete
                          </button>

                          <button
                            onClick={() => {
                              setSelectedReservationId(null);
                              setActionMode(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : selectedReservationId === reservation.id &&
                        actionMode === "edit" ? (
                        <button
                          onClick={() => {
                            setSelectedReservationId(null);
                            setActionMode(null);
                          }}
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          className="primaryButton"
                          onClick={() =>
                            setSelectedReservationId(reservation.id)
                          }
                        >
                          Change
                        </button>
                      )}
                    </td>
                  </tr>

                  {selectedReservationId === reservation.id &&
                    actionMode === "edit" && (
                      <tr>
                        <td colSpan={activeCategory === "Items" ? 7 : 6}>
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              type="datetime-local"
                              min={getNowForInput()}
                              step={1800}
                              value={editData.start_time}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  start_time: roundTo30Minutes(e.target.value),
                                })
                              }
                            />

                            <input
                              type="datetime-local"
                              min={
                                getNowForInput()
                              }
                              step={1800}
                              value={editData.end_time}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  end_time: roundTo30Minutes(e.target.value),
                                })
                              }
                            />

                            {activeCategory === "Items" && (
                              <input
                                type="number"
                                min="1"
                                value={editData.quantity_reserved}
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    quantity_reserved:
                                      parseInt(e.target.value),
                                  })
                                }
                              />
                            )}

                            <button
                              className="primaryButton"
                              onClick={handleUpdateReservation}
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}