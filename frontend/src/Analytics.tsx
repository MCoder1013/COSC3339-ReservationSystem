import { useEffect, useMemo, useState } from "react";
import NavBar from "./NavBar";
import "./App.css";
import { fetchData } from "./api";

type UserRecord = {
  id: number;
  email?: string;
  user_role?: string;
};

type StaffRecord = {
  staff_id: number;
  role?: string;
};

type ReservationRecord = {
  id: number;
  user_id: number;
  email?: string;
  resource_id: number | null;
  resource_name?: string | null;
  quantity_reserved?: number | null;
  start_time: string;
  status?: string | null;
};

type PackageEventRecord = {
  id: number;
  start_time: string;
  total_attendees?: number;
  staff_names?: string;
};

type TopEntry = {
  label: string;
  value: number;
};

function toMonthKey(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return monthKey;
  }

  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function topThree(entries: Map<string, number>): TopEntry[] {
  return [...entries.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function inferUserCategory(
  userId: number,
  usersById: Map<number, UserRecord>
): "User" | "Staff" | "Admin" {
  const user = usersById.get(userId);
  const normalizedRole = String(user?.user_role ?? "").toLowerCase();

  if (normalizedRole === "admin") {
    return "Admin";
  }

  if (normalizedRole === "staff") {
    return "Staff";
  }

  return "User";
}

export default function Analytics() {
  const shipName = "Starlight Pearl Cruises";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [packageEvents, setPackageEvents] = useState<PackageEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setFormError("");

      try {
        const [usersData, reservationsData, staffData, packageEventsData] = await Promise.all([
          fetchData("/api/auth/users"),
          fetchData("/api/reservations"),
          fetchData("/api/staff"),
          fetchData("/api/packages/events"),
        ]);

        setUsers(Array.isArray(usersData) ? (usersData as UserRecord[]) : []);
        setReservations(Array.isArray(reservationsData) ? (reservationsData as ReservationRecord[]) : []);
        setStaff(Array.isArray(staffData) ? (staffData as StaffRecord[]) : []);
        setPackageEvents(Array.isArray(packageEventsData) ? (packageEventsData as PackageEventRecord[]) : []);
      } catch (error) {
        console.error("Failed to load analytics:", error);
        setFormError("Unable to load analytics right now.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();

    for (const reservation of reservations) {
      const key = toMonthKey(reservation.start_time);
      if (key) monthSet.add(key);
    }

    for (const event of packageEvents) {
      const key = toMonthKey(event.start_time);
      if (key) monthSet.add(key);
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthSet.add(currentMonth);

    return [...monthSet].sort((a, b) => b.localeCompare(a));
  }, [reservations, packageEvents]);

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [selectedMonth, availableMonths]);

  const usersById = useMemo(() => {
    const map = new Map<number, UserRecord>();
    for (const user of users) {
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  const staffById = useMemo(() => {
    const map = new Map<number, StaffRecord>();
    for (const member of staff) {
      map.set(member.staff_id, member);
    }
    return map;
  }, [staff]);

  const monthlyReservations = useMemo(() => {
    if (!selectedMonth) return [];
    return reservations.filter((reservation) => toMonthKey(reservation.start_time) === selectedMonth);
  }, [reservations, selectedMonth]);

  const monthlyPackageEvents = useMemo(() => {
    if (!selectedMonth) return [];
    return packageEvents.filter((event) => toMonthKey(event.start_time) === selectedMonth);
  }, [packageEvents, selectedMonth]);

  const analytics = useMemo(() => {
    const uniqueMonthlyUsers = new Set<number>();
    const topItemsMap = new Map<string, number>();
    const topUsersMap = new Map<string, number>();
    const topStaffMap = new Map<string, number>();

    for (const reservation of monthlyReservations) {
      uniqueMonthlyUsers.add(reservation.user_id);

      if (reservation.resource_id !== null) {
        const itemName = reservation.resource_name?.trim() || `Resource #${reservation.resource_id}`;
        const qty = Number(reservation.quantity_reserved ?? 1);
        topItemsMap.set(itemName, (topItemsMap.get(itemName) ?? 0) + (Number.isNaN(qty) ? 1 : qty));
      }

      const user = usersById.get(reservation.user_id);
      const userLabel = user?.email || reservation.email || `User #${reservation.user_id}`;
      topUsersMap.set(userLabel, (topUsersMap.get(userLabel) ?? 0) + 1);
    }

    for (const event of monthlyPackageEvents) {
      const attendees = Number(event.total_attendees ?? 0);
      if (attendees <= 0) continue;

      const names = String(event.staff_names ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

      for (const name of names) {
        topStaffMap.set(name, (topStaffMap.get(name) ?? 0) + attendees);
      }
    }

    const cancelledReservations = reservations.filter(
      (reservation) => String(reservation.status ?? "").toLowerCase() === "cancelled"
    );

    const cancelledReservationsMonthly = monthlyReservations.filter(
      (reservation) => String(reservation.status ?? "").toLowerCase() === "cancelled"
    );

    const cancellationsByCategory = {
      User: 0,
      Staff: 0,
      Admin: 0,
    };

    for (const cancelled of cancelledReservationsMonthly) {
      const category = inferUserCategory(cancelled.user_id, usersById);
      cancellationsByCategory[category] += 1;
    }

    return {
      allTimeRegisteredUsers: users.length,
      allTimeReservations: reservations.length,
      reservationsForSelectedMonth: monthlyReservations.length,
      uniqueUsersForSelectedMonth: uniqueMonthlyUsers.size,
      topItems: topThree(topItemsMap),
      topUsers: topThree(topUsersMap),
      topStaff: topThree(topStaffMap),
      totalCancellations: cancelledReservations.length,
      totalCancellationsForSelectedMonth: cancelledReservationsMonthly.length,
      cancellationsByCategory,
    };
  }, [monthlyPackageEvents, monthlyReservations, reservations, staffById, users, usersById]);

  const selectedMonthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : "Selected Month";

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="container section inventoryDisplay analyticsPanel">
        <h2>Analytics</h2>

        <div className="filterBar analyticsFilterBar">
          <label htmlFor="analytics-month">Month:</label>
          <select
            id="analytics-month"
            className="filterSelect"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            disabled={availableMonths.length === 0}
          >
            {availableMonths.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonthLabel(monthKey)}
              </option>
            ))}
          </select>
        </div>

        <br />

        {formError && <div className="errorMessage">{formError}</div>}

        {loading ? (
          <p>Loading analytics...</p>
        ) : (
          <>
            <table className="inventoryTable analyticsTable">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>All Time Registered Users</td>
                  <td>{analytics.allTimeRegisteredUsers}</td>
                </tr>
                <tr>
                  <td>All Time Reservations</td>
                  <td>{analytics.allTimeReservations}</td>
                </tr>
                <tr>
                  <td>Reservations for {selectedMonthLabel}</td>
                  <td>{analytics.reservationsForSelectedMonth}</td>
                </tr>
                <tr>
                  <td>Unique Users for {selectedMonthLabel}</td>
                  <td>{analytics.uniqueUsersForSelectedMonth}</td>
                </tr>
                <tr>
                  <td>Total Cancellations</td>
                  <td>{analytics.totalCancellations}</td>
                </tr>
                <tr>
                  <td>Total Cancellations for {selectedMonthLabel}</td>
                  <td>{analytics.totalCancellationsForSelectedMonth}</td>
                </tr>
                <tr>
                  <td>Cancellations by Category for {selectedMonthLabel} (User)</td>
                  <td>{analytics.cancellationsByCategory.User}</td>
                </tr>
                <tr>
                  <td>Cancellations by Category for {selectedMonthLabel} (Staff)</td>
                  <td>{analytics.cancellationsByCategory.Staff}</td>
                </tr>
                <tr>
                  <td>Cancellations by Category for {selectedMonthLabel} (Admin)</td>
                  <td>{analytics.cancellationsByCategory.Admin}</td>
                </tr>
              </tbody>
            </table>

            <div className="analyticsTopSection">
              <section>
                <h3>Top 3 Requested Items ({selectedMonthLabel})</h3>
                <table className="inventoryTable analyticsTable compactTable">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Requested Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topItems.length === 0 ? (
                      <tr>
                        <td colSpan={2}>No item data for this month.</td>
                      </tr>
                    ) : (
                      analytics.topItems.map((entry) => (
                        <tr key={entry.label}>
                          <td>{entry.label}</td>
                          <td>{entry.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              <section>
                <h3>Top 3 Users by Reservation Count ({selectedMonthLabel})</h3>
                <table className="inventoryTable analyticsTable compactTable">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Reservations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topUsers.length === 0 ? (
                      <tr>
                        <td colSpan={2}>No reservation-user data for this month.</td>
                      </tr>
                    ) : (
                      analytics.topUsers.map((entry) => (
                        <tr key={entry.label}>
                          <td>{entry.label}</td>
                          <td>{entry.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              <section>
                <h3>Top 3 Staff by Event Reservation Presence ({selectedMonthLabel})</h3>
                <table className="inventoryTable analyticsTable compactTable">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Attendee Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topStaff.length === 0 ? (
                      <tr>
                        <td colSpan={2}>No package-event staff data for this month.</td>
                      </tr>
                    ) : (
                      analytics.topStaff.map((entry) => (
                        <tr key={entry.label}>
                          <td>{entry.label}</td>
                          <td>{entry.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            </div>

            <p className="analyticsFootnote">
              Cancellation categories are derived from the reservation owner role because cancellation-actor metadata is not currently stored.
            </p>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}
