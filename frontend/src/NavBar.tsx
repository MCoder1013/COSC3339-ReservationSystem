import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useState } from "react";
import UserProfileModal from "./UserProfileModal";
import "./NavBar.css";

interface NavBarProps {
  shipName: string;
}

export default function NavBar({ shipName }: NavBarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isHomePage = location.pathname === "/";

  return (
    <>
      <header className="navbar">
        <div className="container headerRow">
          <img src="images/StarlightPearlLogoWithName.png" 
          alt="Starlight Pearl Cruises Logo" className="logo" />
          <h1>{shipName}</h1>
          <nav className="navLinks">
            {!isHomePage && <Link className="navButton" to="/">Home</Link>}
            {user?.role === "staff" && <Link className="navButton" to="/inventory">Inventory</Link>}
            {user?.role === "staff" && <Link className="navButton" to="/reservations">Reservations</Link>}
            {user ? (
              <button 
                className="userIconBtn"
                onClick={() => setIsProfileOpen(true)}
                title={user.firstName}
              >
                <div className="userIconPlaceholder">
                  {user.firstName.charAt(0).toUpperCase()}
                </div>
              </button>
            ) : (
              <Link className="navButton" to="/signin">Sign In</Link>
            )}
          </nav>
        </div>
      </header>

      <UserProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
