/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import "./App.css";
import { fetchData } from "./api";
import { useAuth } from "./AuthContext";
import NavBar from "./NavBar";

type Cruise = {
  id: number;
  cruise_name: string;
  ship_name: string;
  departure_date: string;
  return_date: string;
};

type UserRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  staffRole?: string | null;
  daysRegistered: number;
  totalReservations: number;
  pastReservations: number;
  upcomingReservations: number;
};

export default function ViewAllUsers() {
  const shipName = "Starlight Pearl Cruises";
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cruises, setCruises] = useState<Cruise[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string>("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<string>("normal");
  const [selectedCruiseIds, setSelectedCruiseIds] = useState<number[]>([]);

  const isAdminView = Boolean(user?.canEditInventory);

  const getEffectiveRole = (baseRole: string, staffRole?: string | null) => {
    const normalizedBaseRole = String(baseRole ?? "").trim().toLowerCase();
    const normalizedStaffRole = String(staffRole ?? "").trim().toLowerCase();

    if (normalizedBaseRole === "staff" && normalizedStaffRole === "admin") {
      return "admin";
    }

    return normalizedBaseRole || "normal";
  };

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
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: getEffectiveRole(user.user_role, user.staff_role),
          staffRole: user.staff_role,
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

  useEffect(() => {
    const loadCruises = async () => {
      try {
        const allCruises = await fetchData("/api/cruises");
        setCruises(Array.isArray(allCruises) ? allCruises : []);
      } catch (error) {
        console.error("Error fetching cruises:", error);
      }
    };

    if (isAdminView) {
      loadCruises();
    }
  }, [isAdminView]);

  const handleEditRole = async (userRow: UserRow) => {
    setSelectedUser(userRow);
    const modalRole = getEffectiveRole(userRow.role, userRow.staffRole);
    setNewRole(modalRole);
    setSelectedCruiseIds([]);
    setFormError("");
    setShowRoleModal(true);

    if (modalRole === "staff" || modalRole === "admin") {
      try {
        const assignedCruises = await fetchData(`/api/auth/staff/${userRow.id}/cruises`);
        const ids = Array.isArray(assignedCruises)
          ? assignedCruises.map((c: { id: number }) => Number(c.id)).filter((id: number) => Number.isInteger(id))
          : [];
        setSelectedCruiseIds(ids);
      } catch (error) {
        console.error("Failed to fetch assigned cruises:", error);
      }
    }
  };

  const toggleCruiseSelection = (cruiseId: number) => {
    setSelectedCruiseIds((prev) =>
      prev.includes(cruiseId) ? prev.filter((id) => id !== cruiseId) : [...prev, cruiseId]
    );
  };

  // const handleEditRole = (userRow: any) => {
  //   setSelectedUser(userRow);
  //   setNewRole("normal");
  //   setShowRoleModal(true);
  // };

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
          cruiseIds: newRole === "staff" || newRole === "admin" ? selectedCruiseIds : [],
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
      setSelectedCruiseIds([]);
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
                <th>Role</th>
                <th>Days Registered</th>
                <th>Total Reservations</th>
                <th>Past Reservations</th>
                <th>Upcoming Reservations</th>
                {isAdminView && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((userRow) => (
                <tr key={userRow.id}>
                  <td>{userRow.id}</td>
                  <td>{userRow.email}</td>
                  <td>{userRow.role}</td>
                  <td>{userRow.daysRegistered}</td>
                  <td>{userRow.totalReservations}</td>
                  <td>{userRow.pastReservations}</td>
                  <td>{userRow.upcomingReservations}</td>
                  {isAdminView && (
                    <td>
                      <button
                        className="primaryBtn"
                        onClick={() => handleEditRole(userRow)}
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                      >
                        Manage
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
              <h3>Manage User</h3>
              <p>
                User: {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
              </p>

              <form onSubmit={handleRoleUpdate}>
                <label>
                  New Role:
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="normal">Normal User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin (staff with admin permissions)</option>
                  </select>
                </label>

                {(newRole === "staff" || newRole === "admin") && (
                  <>
                    <br />
                    <br />
                    <label>Assigned Cruises (non-overlapping only):</label>
                    <div
                      style={{
                        maxHeight: "180px",
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        borderRadius: "8px",
                        padding: "8px",
                      }}
                    >
                      {cruises.length === 0 ? (
                        <p style={{ margin: 0 }}>No cruises found.</p>
                      ) : (
                        cruises.map((cruise) => (
                          <label
                            key={cruise.id}
                            style={{ display: "block", marginBottom: "6px", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCruiseIds.includes(cruise.id)}
                              onChange={() => toggleCruiseSelection(cruise.id)}
                              style={{ marginRight: "8px" }}
                            />
                            {cruise.cruise_name} ({cruise.departure_date} to {cruise.return_date})
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}

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