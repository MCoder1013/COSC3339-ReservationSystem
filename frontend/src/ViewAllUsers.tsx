/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import NavBar from "./NavBar";

export default function ViewAllUsers() {
  const shipName = "Starlight Pearl Cruises";
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [allUsers, allReservations] = await Promise.all([
        fetchData("/api/auth/users"),
        fetchData("/api/reservations"),
      ]);

      const now = new Date();

      const enriched = allUsers.map((user: any) => {
        const userReservations = allReservations.filter(
          (res: any) => res.user_id === user.id || res.email === user.email
        );

        const past = userReservations.filter(
          (res: any) => new Date(res.end_time) < now
        ).length;

        const upcoming = userReservations.filter(
          (res: any) => new Date(res.start_time) >= now
        ).length;

        const daysRegistered = Math.floor(
          (now.getTime() - new Date(user.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        return {
          id: user.id,
          email: user.email,
          daysRegistered,
          totalReservations: userReservations.length,
          pastReservations: past,
          upcomingReservations: upcoming,
        };
      });

      setUsers(enriched);
      setFormError("");
    } catch (error) {
      console.error("Error fetching users:", error);
      setFormError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section inventoryDisplay">
        <h2>Users</h2>

        <br />

        {formError && <div className="errorMessage">{formError}</div>}

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <table className="inventoryTable">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Days Registered</th>
                <th>Total Reservations</th>
                <th>Past Reservations</th>
                <th>Upcoming Reservations</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.daysRegistered}</td>
                  <td>{user.totalReservations}</td>
                  <td>{user.pastReservations}</td>
                  <td>{user.upcomingReservations}</td>
                </tr>
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