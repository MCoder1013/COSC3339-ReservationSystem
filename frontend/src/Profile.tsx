import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { fetchData, submitData } from "./api";
import "./App.css";

interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  biography: string | null;
  profilePicture: string | null;
  role: string;
}

export default function Profile() {
    const shipName = "Starlight Pearl Cruises";
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(false);
    const [biography, setBiography] = useState("");
    const [, setProfilePicture] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        fetchData("/api/auth/me").then((data) => {
        setProfile(data);
        setBiography(data.biography ?? "");
        setProfilePicture(data.profilePicture ?? "");
        }).catch(() => setError("Failed to load profile."));
    }, []);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleSignOut = async () => {
        await submitData("/api/auth/signout", {});
        setUser(null);
        navigate("/signin");
    };

    const handleSave = async () => {
        const formData = new FormData();

        if (biography !== (profile?.biography ?? "")) {
            formData.append("biography", biography);
        }
        if (imageFile) {
            formData.append("profilePicture", imageFile);
        }

        // nothing changed
        if ([...formData.entries()].length === 0) {
            setEditing(false);
            return;
        }

        const res = await fetch("/api/auth/update-profile", {
            method: "POST",
            credentials: "include",
            body: formData,
        });
        const data = await res.json();

        if (data.error) {
            setError(data.error);
        } else {
            setProfile((prev) => prev ? {
            ...prev,
            biography: biography !== (prev.biography ?? "") ? biography : prev.biography,
            profilePicture: data.profilePicture ?? prev.profilePicture,
            } : prev);
            setSaveMessage("Profile updated!");
            setEditing(false);
            setTimeout(() => setSaveMessage(""), 2000);
        }
    };

    return (
        <div className="page">
        <header className="navbar">
            <div className="container headerRow">
            <img src="images/StarlightPearlLogoWithName.png"
                alt="Starlight Pearl Cruises Logo" className="logo" />
            <h1>{shipName}</h1>
            <nav className="navLinks">
                <Link className="navButton" to="/">Home</Link>
                {user?.user_role === "staff" && <>
                <Link className="navButton" to="/inventory">Inventory</Link>
                <Link className="navButton" to="/reservations">Reservations</Link>
                </>}
                {user?.user_role === "normal" &&
                <Link className="navButton" to="/user-reservations">My Reservations</Link>
                }
            </nav>
            </div>
        </header>

        <main className="container centeredContent">
            <section className="centerCard">
            <h2>My Profile</h2>
            {error && <p className="errorText">{error}</p>}
            {saveMessage && <p className="register-message">{saveMessage}</p>}
            {profile ? (
                <div className="profileInfo">
                {profile.profilePicture ? (
                    <img src={profile.profilePicture} alt="Profile" className="profileImage" />
                ) : (
                    <div className="profileImagePlaceholder">No Image</div>
                )}
                <p><strong>Bio:</strong> {profile.biography ?? "No biography yet."}</p>
                <p><strong>First Name:</strong> {profile.firstName}</p>
                <p><strong>Last Name:</strong> {profile.lastName}</p>
                <p><strong>Email:</strong> {profile.email}</p>

                {!editing ? (
                    <button className="primaryBtn" onClick={() => setEditing(true)}>Edit Profile</button>
                ) : (
                    <div className="form">
                    <label className="label">
                        Biography
                        <textarea
                        className="input"
                        value={biography}
                        onChange={(e) => setBiography(e.target.value)}
                        rows={4}
                        placeholder="Tell us about yourself..."
                        />
                    </label>
                    <br />
                        <label className="label">
                        Profile Picture
                        <input
                            className="input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                        />
                        </label>
                    <br />
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <button className="primaryBtn" onClick={handleSave}>Save</button>
                        <button className="navButton" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                    </div>
                )}
                <br />
                <br />
                <button className="navButton" onClick={handleSignOut}>Sign Out</button>
                </div>
            ) : (
                !error && <p>Loading...</p>
            )}
            </section>
        </main>

        <footer className="footer">
            <div className="container">© 2026 {shipName}</div>
        </footer>
        </div>
    );
}