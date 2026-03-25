/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import NavBar from "./NavBar";
import { useAuth } from "./AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

export default function ViewAllUsers() {
  const shipName = "Starlight Pearl Cruises";
  const { user: currentUser } = useAuth();
  const isCurrentUserAdmin = currentUser?.role === "admin";
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>("");
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

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
          userRole: user.user_role,
          isAdmin: Boolean(user.is_admin),
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

  const toggleAdminStatus = async (targetUserId: number, nextIsAdmin: boolean) => {
    setBusyUserId(targetUserId);
    setFormError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/users/${targetUserId}/admin`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isAdmin: nextIsAdmin }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update admin status");
      }

      await loadUsers();
    } catch (error: any) {
      setFormError(error.message || "Failed to update admin status.");
    } finally {
      setBusyUserId(null);
    }
  };

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
                <th>User Role</th>
                <th>Staff Role</th>
                <th>Days Registered</th>
                <th>Total Reservations</th>
                <th>Past Reservations</th>
                <th>Upcoming Reservations</th>
                {isCurrentUserAdmin && <th>Admin Controls</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.userRole}</td>
                  <td>{user.userRole === "staff" ? (user.isAdmin ? "Admin" : "Staff") : "N/A"}</td>
                  <td>{user.daysRegistered}</td>
                  <td>{user.totalReservations}</td>
                  <td>{user.pastReservations}</td>
                  <td>{user.upcomingReservations}</td>
                  {isCurrentUserAdmin && (
                    <td>
                      {user.userRole === "staff" ? (
                        <button
                          className="primaryButton"
                          onClick={() => toggleAdminStatus(user.id, !user.isAdmin)}
                          disabled={busyUserId === user.id}
                        >
                          {busyUserId === user.id
                            ? "Saving..."
                            : user.isAdmin
                            ? "Demote to Staff"
                            : "Promote to Admin"}
                        </button>
                      ) : (
                        <span>N/A</span>
                      )}
                    </td>
                  )}
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