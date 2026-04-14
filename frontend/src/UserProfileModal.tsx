import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./UserProfileModal.css";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  biography: string | null;
  profilePicture: string | null;
  role: string;
  shift?: string | null;
}

type ShiftConflict = {
  id: number;
  name: string;
  required_shift: string;
  start_time: string;
  end_time: string;
};

interface ItemReservation {
  id: number;
  resource_name: string;
  quantity_reserved: number;
  email: string;
  start_time: string;
  end_time: string;
}

interface RoomReservation {
  id: number;
  cabin_number: string;
  email: string;
  start_time: string;
  end_time: string;
}

interface PackageReservation {
  id: number;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  joined_at: string;
  staff_names: string;
}



export default function UserProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"reservations" | "editinfo">("reservations");
  const [reservationCategory, setReservationCategory] = useState<"Items" | "Rooms" | "Packages">("Items");
  const [timePeriod, setTimePeriod] = useState<"Past" | "Current" | "Future">("Future");
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [itemsReservations, setItemsReservations] = useState<ItemReservation[]>([]);
  const [roomsReservations, setRoomsReservations] = useState<RoomReservation[]>([]);
  const [packagesReservations, setPackagesReservations] = useState<PackageReservation[]>([]);
  const [bio, setBio] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [selectedShift, setSelectedShift] = useState("Day");
  const [saveMessage, setSaveMessage] = useState("");
  const [shiftConflicts, setShiftConflicts] = useState<ShiftConflict[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");

        const profileRes = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!profileRes.ok) throw new Error("Failed to fetch profile");

        const profileData = await profileRes.json();
        setUserProfile(profileData);
        setBio(profileData.biography || "");
        setIconPreview(profileData.profilePicture || "");
        setSelectedShift(profileData.shift || "Day");
        setShiftConflicts([]);

        const itemsRes = await fetch("api/reservations/items", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const itemsData = await itemsRes.json();
        setItemsReservations(itemsData);

        const roomsRes = await fetch("api/reservations/rooms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const roomsData = await roomsRes.json();
        setRoomsReservations(roomsData);

        const packagesRes = await fetch("api/packages/my-events", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          setPackagesReservations(Array.isArray(packagesData) ? packagesData : []);
        } else {
          setPackagesReservations([]);
        }

      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [isOpen]);

  // Function to format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Filter reservations by time period
  const filterByTimePeriod = <T extends { start_time: string; end_time: string }>(reservations: T[]): T[] => {
    const now = new Date();

    return reservations.filter((res) => {
      const startTime = new Date(res.start_time);
      const endTime = new Date(res.end_time);

      if (timePeriod === "Past") {
        // Past: end time is before now
        return endTime < now;
      } else if (timePeriod === "Current") {
        // Current: now is between start and end time
        return startTime <= now && endTime >= now;
      } else {
        // Future: start time is after now
        return startTime > now;
      }
    });
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      setShiftConflicts([]);

      const formData = new FormData();
      formData.append("biography", bio);

      if (userProfile?.role === "staff") {
        formData.append("shift", selectedShift);
      }

      if (iconFile) {
        formData.append("profilePicture", iconFile);
      }

      const response = await fetch("api/auth/update-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const conflicts = Array.isArray(responseData.shiftConflicts)
          ? (responseData.shiftConflicts as ShiftConflict[])
          : [];
        setShiftConflicts(conflicts);
        throw new Error(responseData.error || "Failed to update profile");
      }

      const updatedUser = responseData;
      const updatedShift = updatedUser.shift ?? currentUserShiftFromProfile(updatedUser, selectedShift);
      setUserProfile((current) => current ? {
        ...current,
        biography: bio,
        profilePicture: updatedUser.profilePicture ?? current.profilePicture,
        shift: updatedShift,
      } : current);
      const nextPicture = updatedUser.profilePicture ?? updatedUser.profile_picture ?? iconPreview ?? null;
      setIconPreview(nextPicture || "");
      setSelectedShift(updatedShift);

      updateUser({
        firstName: updatedUser.firstName ?? updatedUser.first_name ?? user?.firstName,
        profilePicture: nextPicture,
        shift: updatedShift,
      });

      setSaveMessage("Profile updated successfully!");

    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message
        ? err.message
        : "Error updating profile";
      setSaveMessage(message);
    }

    setTimeout(() => setSaveMessage(""), 3000);
  };

  function currentUserShiftFromProfile(updatedUser: any, fallbackShift: string) {
    return updatedUser.shift ?? updatedUser.staffShift ?? fallbackShift;
  }

  const handleLogout = () => {
    logout();
    onClose();
    navigate("/", { replace: true });
  };

  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2>User Profile</h2>
          <button className="closeBtn" onClick={onClose}>✕</button>
        </div>

        <div className="tabButtons">
          <button
            className={`tabBtn ${activeTab === "reservations" ? "active" : ""}`}
            onClick={() => setActiveTab("reservations")}
          >
            My Reservations
          </button>
          <button
            className={`tabBtn ${activeTab === "editinfo" ? "active" : ""}`}
            onClick={() => setActiveTab("editinfo")}
          >
            Edit Profile
          </button>
        </div>

        <div className="tabContent">
          {activeTab === "reservations" && (
            <div className="reservationsTab">
              <h3>My Reservations</h3>

              {/* Category tabs for Items, Rooms, Packages */}
              <div className="categoryTabs">
                <button
                  className={`categoryBtn ${reservationCategory === "Rooms" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Rooms")}
                >
                  Rooms
                </button>
                <button
                  className={`categoryBtn ${reservationCategory === "Items" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Items")}
                >
                  Items
                </button>
                <button
                  className={`categoryBtn ${reservationCategory === "Packages" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Packages")}
                >
                  Packages
                </button>
              </div>

              {/* Time period tabs for Past, Current, Future */}
              <div className="timePeriodTabs">
                <button
                  className={`timePeriodBtn ${timePeriod === "Past" ? "active" : ""}`}
                  onClick={() => setTimePeriod("Past")}
                >
                  Past
                </button>
                <button
                  className={`timePeriodBtn ${timePeriod === "Current" ? "active" : ""}`}
                  onClick={() => setTimePeriod("Current")}
                >
                  Current
                </button>
                <button
                  className={`timePeriodBtn ${timePeriod === "Future" ? "active" : ""}`}
                  onClick={() => setTimePeriod("Future")}
                >
                  Future
                </button>
              </div>

              {/* Content for each category */}
              {reservationCategory === "Items" && (
                (() => {
                  const filteredItems = filterByTimePeriod(itemsReservations);
                  return filteredItems.length === 0 ? (
                    <p className="noDataMessage">You have no {timePeriod.toLowerCase()} items reservations.</p>
                  ) : (
                    <table className="reservationsTable">
                      <thead>
                        <tr>
                          <th>Reservation ID</th>
                          <th>Item Reserved</th>
                          <th>Quantity</th>
                          <th>User Email</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((res) => (
                          <tr key={res.id}>
                            <td>{res.id}</td>
                            <td>{res.resource_name}</td>
                            <td>{res.quantity_reserved}</td>
                            <td>{res.email}</td>
                            <td>{formatDateTime(res.start_time)}</td>
                            <td>{formatDateTime(res.end_time)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}

              {reservationCategory === "Rooms" && (
                (() => {
                  const filteredRooms = filterByTimePeriod(roomsReservations);
                  return filteredRooms.length === 0 ? (
                    <p className="noDataMessage">You have no {timePeriod.toLowerCase()} rooms reservations.</p>
                  ) : (
                    <table className="reservationsTable">
                      <thead>
                        <tr>
                          <th>Reservation ID</th>
                          <th>Cabin Number</th>
                          <th>User Email</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRooms.map((res) => (
                          <tr key={res.id}>
                            <td>{res.id}</td>
                            <td>{res.cabin_number}</td>
                            <td>{res.email}</td>
                            <td>{formatDateTime(res.start_time)}</td>
                            <td>{formatDateTime(res.end_time)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}

              {reservationCategory === "Packages" && (
                (() => {
                  const filteredPackages = filterByTimePeriod(packagesReservations);
                  return filteredPackages.length === 0 ? (
                    <p className="noDataMessage">You have no {timePeriod.toLowerCase()} package events.</p>
                  ) : (
                    <table className="reservationsTable">
                      <thead>
                        <tr>
                          <th>Event Name</th>
                          <th>Staff Running</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPackages.map((res) => (
                          <tr key={res.id}>
                            <td>{res.name}</td>
                            <td>{res.staff_names || "TBD"}</td>
                            <td>{formatDateTime(res.start_time)}</td>
                            <td>{formatDateTime(res.end_time)}</td>
                            <td>{res.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </div>
          )}

          {activeTab === "editinfo" && (
            <div className="editInfoTab">
              <h3>Edit Profile Information</h3>
              {userProfile && (
                <div className="editForm">
                  <div className="formGroup">
                    <label>Name:</label>
                    <p>{userProfile.firstName} {userProfile.lastName}</p>
                  </div>

                  <div className="formGroup">
                    <label>Email:</label>
                    <p>{userProfile.email}</p>
                  </div>

                  <div className="formGroup">
                    <label>Bio:</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      className="bioInput"
                    />
                  </div>

                  {userProfile.role === "staff" && (
                    <div className="formGroup">
                      <label>Shift:</label>
                      <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="input"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Day">Day</option>
                        <option value="Night">Night</option>
                      </select>
                    </div>
                  )}

                  <div className="formGroup">
                    <label>User Icon:</label>
                    <div className="iconUpload">
                      {iconPreview && (
                        <div className="iconPreviewWrapper">
                          <img src={iconPreview} alt="Icon preview" className="iconPreview" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIconChange}
                        className="fileInput"
                      />
                    </div>
                  </div>

                  {saveMessage && (
                    <p className={saveMessage.includes("Error") || saveMessage.includes("error") ? "errorMsg" : "successMsg"}>
                      {saveMessage}
                    </p>
                  )}

                  {shiftConflicts.length > 0 && (
                    <div className="errorMsg">
                      {shiftConflicts.map((conflict) => (
                        <div key={conflict.id}>
                          Conflict: {conflict.name} requires {conflict.required_shift} shift on {formatDateTime(conflict.start_time)}.
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleSaveProfile} className="saveBtn">
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modalFooter">
          <button onClick={handleLogout} className="logoutBtn">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
