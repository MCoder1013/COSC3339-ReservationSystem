import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./UserProfileModal.css";

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  iconUrl: string;
}

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

// Dummy data
const DUMMY_USER_PROFILE: UserProfile = {
  id: 1,
  firstName: "John",
  lastName: "Smith",
  email: "john.smith@example.com",
  bio: "Passionate traveler and adventure enthusiast. Love exploring new destinations and meeting people from around the world!",
  iconUrl: ""
};

const DUMMY_ITEMS_RESERVATIONS: ItemReservation[] = [
  {
    id: 1,
    resource_name: "Beach Chairs",
    quantity_reserved: 2,
    email: "john.smith@example.com",
    start_time: "2026-03-10T09:00:00",
    end_time: "2026-03-10T17:00:00",
  },
  {
    id: 2,
    resource_name: "Snorkeling Gear",
    quantity_reserved: 4,
    email: "john.smith@example.com",
    start_time: "2026-03-12T10:00:00",
    end_time: "2026-03-12T15:00:00",
  },
];

const DUMMY_ROOMS_RESERVATIONS: RoomReservation[] = [
  {
    id: 101,
    cabin_number: "A-201",
    email: "john.smith@example.com",
    start_time: "2026-03-10T14:00:00",
    end_time: "2026-03-15T11:00:00",
  },
  {
    id: 102,
    cabin_number: "B-305",
    email: "john.smith@example.com",
    start_time: "2026-04-01T14:00:00",
    end_time: "2026-04-08T11:00:00",
  },
];

export default function UserProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"reservations" | "editinfo">("reservations");
  const [reservationCategory, setReservationCategory] = useState<"Items" | "Rooms" | "Packages">("Items");
  const [timePeriod, setTimePeriod] = useState<"Past" | "Current" | "Future">("Future");
  const [userProfile, setUserProfile] = useState<UserProfile>(DUMMY_USER_PROFILE);
  const [itemsReservations, setItemsReservations] = useState<ItemReservation[]>(DUMMY_ITEMS_RESERVATIONS);
  const [roomsReservations, setRoomsReservations] = useState<RoomReservation[]>(DUMMY_ROOMS_RESERVATIONS);
  const [bio, setBio] = useState(DUMMY_USER_PROFILE.bio);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUserProfile(DUMMY_USER_PROFILE);
      setItemsReservations(DUMMY_ITEMS_RESERVATIONS);
      setRoomsReservations(DUMMY_ROOMS_RESERVATIONS);
      setBio(DUMMY_USER_PROFILE.bio);
      setIconPreview(DUMMY_USER_PROFILE.iconUrl);
    }
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

  const handleSaveProfile = () => {
    // Simulate saving - just show success message
    setSaveMessage("Profile updated successfully!");
    setTimeout(() => setSaveMessage(""), 3000);
  };

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
                  className={`categoryBtn ${reservationCategory === "Items" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Items")}
                >
                  Items
                </button>
                <button
                  className={`categoryBtn ${reservationCategory === "Rooms" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Rooms")}
                >
                  Rooms
                </button>
                <button
                  className={`categoryBtn ${reservationCategory === "Packages" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Packages")}
                >
                  Packages
                </button>
              </div>

              {/* Time period tabs for Past, Current, Future */}
              {reservationCategory !== "Packages" && (
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
              )}

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
                <div style={{ textAlign: "center", padding: "40px", fontSize: "16px" }}>
                  <p>Package Reservations Coming Soon!</p>
                </div>
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
