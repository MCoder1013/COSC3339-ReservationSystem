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
  status?: string;
}

interface RoomReservation {
  id: number;
  cabin_number: string;
  email: string;
  start_time: string;
  end_time: string;
  status?: string;
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

type CancelledReservation = {
  id: number;
  type: "Item" | "Room";
  name: string;
  email: string;
  start_time: string;
  end_time: string;
};

export default function UserProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"reservations" | "profile">("reservations");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [reservationCategory, setReservationCategory] = useState<"Items" | "Rooms" | "Packages" | "Cancelled">("Items");
  const [timePeriod, setTimePeriod] = useState<"Past" | "Current" | "Future">("Future");
  const [userProfile, setUserProfile] = useState<UserProfile>();
  const [itemsReservations, setItemsReservations] = useState<ItemReservation[]>([]);
  const [roomsReservations, setRoomsReservations] = useState<RoomReservation[]>([]);
  const [packagesReservations, setPackagesReservations] = useState<PackageReservation[]>([]);
  const [cancelledReservations, setCancelledReservations] = useState<CancelledReservation[]>([]);
  const [bio, setBio] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [selectedShift, setSelectedShift] = useState("Day");
  const [saveMessage, setSaveMessage] = useState("");
  const [shiftConflicts, setShiftConflicts] = useState<ShiftConflict[]>([]);
  const loyaltyTier = {
    name: "Barnacle Tier",
    pearls: 639,
    badgeSrc: "/images/barnacle-tier-badge.png",
    accent: "#6f76ff",
    accentDark: "#2b2f86",
    accentSoft: "rgba(111, 118, 255, 0.18)",
  };

  const isProfileStaff = userProfile?.role === "staff" || userProfile?.role === "admin";

  const resetProfileEditor = () => {
    setSaveMessage("");
    setShiftConflicts([]);
    setIconFile(null);
    setBio(userProfile?.biography || "");
    setIconPreview(userProfile?.profilePicture || "");
    setSelectedShift(userProfile?.shift || "Day");
    setIsEditingProfile(false);
  };

  const openProfileEditor = () => {
    setSaveMessage("");
    setShiftConflicts([]);
    setBio(userProfile?.biography || "");
    setIconPreview(userProfile?.profilePicture || "");
    setSelectedShift(userProfile?.shift || "Day");
    setIconFile(null);
    setIsEditingProfile(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");

        const profileRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!profileRes.ok) throw new Error("Failed to fetch profile");

        const profileData = await profileRes.json();
        setUserProfile(profileData);
        setBio(profileData.biography || "");
        setIconPreview(profileData.profilePicture || "");
        setSelectedShift(profileData.shift || "Day");
        setShiftConflicts([]);
        setSaveMessage("");
        setIsEditingProfile(false);
        setIconFile(null);

        const itemsRes = await fetch("api/reservations/items", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const itemsData: ItemReservation[] = await itemsRes.json();

        const roomsRes = await fetch("api/reservations/rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const roomsData: RoomReservation[] = await roomsRes.json();

        // Split active vs cancelled
        setItemsReservations(itemsData.filter((r) => r.status !== "Cancelled"));
        setRoomsReservations(roomsData.filter((r) => r.status !== "Cancelled"));

        // Combine cancelled from both into one list
        const cancelledItems: CancelledReservation[] = itemsData
          .filter((r) => r.status === "Cancelled")
          .map((r) => ({
            id: r.id,
            type: "Item",
            name: r.resource_name,
            email: r.email,
            start_time: r.start_time,
            end_time: r.end_time,
          }));

        const cancelledRooms: CancelledReservation[] = roomsData
          .filter((r) => r.status === "Cancelled")
          .map((r) => ({
            id: r.id,
            type: "Room",
            name: r.cabin_number,
            email: r.email,
            start_time: r.start_time,
            end_time: r.end_time,
          }));

        setCancelledReservations(
          [...cancelledItems, ...cancelledRooms].sort(
            (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
          )
        );

        const packagesRes = await fetch("api/packages/my-events", {
          headers: { Authorization: `Bearer ${token}` },
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const filterByTimePeriod = <T extends { start_time: string; end_time: string }>(reservations: T[]): T[] => {
    const now = new Date();

    return reservations.filter((res) => {
      const startTime = new Date(res.start_time);
      const endTime = new Date(res.end_time);

      if (timePeriod === "Past") {
        return endTime < now;
      } else if (timePeriod === "Current") {
        return startTime <= now && endTime >= now;
      } else {
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

      if (userProfile?.role === "staff" || userProfile?.role === "admin") {
        formData.append("shift", selectedShift);
      }

      if (iconFile) {
        formData.append("profilePicture", iconFile);
      }

      const response = await fetch("api/auth/update-profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

      setIsEditingProfile(false);

      setSaveMessage("Profile updated successfully!");

    } catch (err) {
      console.error(err);
      setSaveMessage("Error updating profile");
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
            onClick={() => {
              resetProfileEditor();
              setActiveTab("reservations");
            }}
          >
            My Reservations
          </button>
          <button
            className={`tabBtn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            My Profile
          </button>
        </div>

        <div className="tabContent">
          {activeTab === "reservations" && (
            <div className="reservationsTab">
              <h3>My Reservations</h3>

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
                <button
                  className={`categoryBtn ${reservationCategory === "Cancelled" ? "active" : ""}`}
                  onClick={() => setReservationCategory("Cancelled")}
                >
                  Cancelled
                </button>
              </div>

              {/* Time period tabs — hidden for Cancelled since they're already done */}
              {reservationCategory !== "Cancelled" && (
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

              {reservationCategory === "Cancelled" && (
                cancelledReservations.length === 0 ? (
                  <p className="noDataMessage">You have no cancelled reservations.</p>
                ) : (
                  <table className="reservationsTable">
                    <thead>
                      <tr>
                        <th>Reservation ID</th>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Start</th>
                        <th>End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledReservations.map((res) => (
                        <tr key={`${res.type}-${res.id}`}>
                          <td>{res.id}</td>
                          <td>{res.type}</td>
                          <td>{res.name}</td>
                          <td>{res.email}</td>
                          <td>{formatDateTime(res.start_time)}</td>
                          <td>{formatDateTime(res.end_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}

          {activeTab === "profile" && userProfile && (
            <div className="profileTab">
              <div className="profileHeaderRow">
                <h3>My Profile</h3>
                <div className="profileActions">
                  {isEditingProfile ? (
                    <button type="button" className="secondaryBtn" onClick={resetProfileEditor}>
                      Cancel
                    </button>
                  ) : (
                    <button type="button" className="secondaryBtn" onClick={openProfileEditor}>
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>

              <div
                className="loyaltyBanner loyaltyBanner--profile"
                style={{
                  background: `linear-gradient(135deg, ${loyaltyTier.accentDark} 0%, ${loyaltyTier.accent} 55%, #9ca2ff 100%)`,
                }}
              >
                <div className="loyaltyBadgeWrap" aria-hidden="true">
                  <div className="loyaltyBadgeGlow" />
                  <img
                    className="loyaltyBadgeImage"
                    src={loyaltyTier.badgeSrc}
                    alt=""
                    role="presentation"
                  />
                </div>

                <div className="loyaltyTierCopy">
                  <span className="loyaltyTierName">{loyaltyTier.name}</span>
                </div>

                <div className="loyaltyPearls">
                  <span className="loyaltyLabel">Pearls</span>
                  <span className="loyaltyPearlCount">{loyaltyTier.pearls.toLocaleString()}</span>
                </div>
              </div>

              <div className="profileCard">
                <div className="profileAvatarSection">
                  <div className="profileAvatar">
                    {iconPreview || userProfile.profilePicture ? (
                      <img
                        src={iconPreview || userProfile.profilePicture || ""}
                        alt={`${userProfile.firstName} ${userProfile.lastName} profile icon`}
                      />
                    ) : (
                      <span>{userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="profileName">{userProfile.firstName} {userProfile.lastName}</p>
                    <p className="profileEmail">{userProfile.email}</p>
                  </div>
                </div>

                <div className="profileFields">
                  <div className="formGroup">
                    <label>Bio:</label>
                    {isEditingProfile ? (
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={4}
                        className="bioInput"
                      />
                    ) : (
                      <p>{userProfile.biography || "No bio added yet."}</p>
                    )}
                  </div>

                  {isProfileStaff && (
                    <div className="formGroup">
                      <label>Shift:</label>
                      {isEditingProfile ? (
                        <select
                          value={selectedShift}
                          onChange={(e) => setSelectedShift(e.target.value)}
                          className="input"
                        >
                          <option value="Morning">Morning</option>
                          <option value="Day">Day</option>
                          <option value="Night">Night</option>
                        </select>
                      ) : (
                        <p>{userProfile.shift || "No shift assigned."}</p>
                      )}
                    </div>
                  )}

                  {isEditingProfile && (
                    <div className="formGroup">
                      <label>User Icon:</label>
                      <div className="iconUpload">
                        {(iconPreview || userProfile.profilePicture) && (
                          <div className="iconPreviewWrapper">
                            <img src={iconPreview || userProfile.profilePicture || ""} alt="Icon preview" className="iconPreview" />
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
                  )}

                  {!isEditingProfile && (
                    <div className="profileNote">
                      Use Edit Profile to update your bio, shift, or icon.
                    </div>
                  )}

                  {isEditingProfile && saveMessage && (
                    <p className={saveMessage.includes("Error") || saveMessage.includes("error") ? "errorMsg" : "successMsg"}>
                      {saveMessage}
                    </p>
                  )}

                  {isEditingProfile && shiftConflicts.length > 0 && (
                    <div className="errorMsg">
                      {shiftConflicts.map((conflict) => (
                        <div key={conflict.id}>
                          Conflict: {conflict.name} requires {conflict.required_shift} shift on {formatDateTime(conflict.start_time)}.
                        </div>
                      ))}
                    </div>
                  )}

                  {isEditingProfile && (
                    <div className="profileActionRow">
                      <button onClick={handleSaveProfile} className="saveBtn">
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              </div>
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