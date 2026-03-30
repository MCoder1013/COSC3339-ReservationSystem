/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import { useAuth } from "./AuthContext";
import NavBar from "./NavBar";

export default function ViewAllUsers() {
  const shipName = "Starlight Pearl Cruises";
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<string>("normal");

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

  const handleEditRole = (userRow: any) => {
    setSelectedUser(userRow);
    setNewRole("normal");
    setShowRoleModal(true);
  };

  const handleRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const response = await fetch("/api/auth/update-user-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          newRole: newRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormError(data.error || "Failed to update user role");
        return;
      }

      setFormError("");
      setShowRoleModal(false);
      setSelectedUser(null);
      loadUsers(); // Refresh the user list
    } catch (error) {
      console.error("Error updating role:", error);
      setFormError("An error occurred while updating the role.");
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
                <th>Days Registered</th>
                <th>Total Reservations</th>
                <th>Past Reservations</th>
                <th>Upcoming Reservations</th>
                {user?.canEditInventory && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((userRow) => (
                <tr key={userRow.id}>
                  <td>{userRow.id}</td>
                  <td>{userRow.email}</td>
                  <td>{userRow.daysRegistered}</td>
                  <td>{userRow.totalReservations}</td>
                  <td>{userRow.pastReservations}</td>
                  <td>{userRow.upcomingReservations}</td>
                  {user?.canEditInventory && (
                    <td>
                      <button
                        className="primaryBtn"
                        onClick={() => handleEditRole(userRow)}
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                      >
                        Edit Role
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showRoleModal && selectedUser && (
          <div className="modal" onClick={() => setShowRoleModal(false)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
              <h3>Edit User Role</h3>
              <p>User: {selectedUser.email}</p>

              <form onSubmit={handleRoleUpdate}>
                <label>
                  New Role:
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="normal">Normal User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin (Staff with Admin role)</option>
                  </select>
                </label>

                <br />
                <br />

                {formError && <div className="errorMessage">{formError}</div>}

                <button type="submit" className="primaryBtn">
                  Update Role
                </button>
                <button
                  type="button"
                  className="deleteButton"
                  onClick={() => setShowRoleModal(false)}
                  style={{ marginLeft: "10px" }}
                >
                  Cancel
                </button>
              </form>
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