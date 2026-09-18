import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import api from "../api/api";

function BottomNav() {
  const [profileImage, setProfileImage] = useState<string | undefined>();

  useEffect(() => { api.get("/users/me").then(r => setProfileImage(r.data?.profileImageUrl)).catch(() => {}); }, []);

  const navItemClass = ({ isActive }: { isActive: boolean }) => `bottom-nav-item ${isActive ? "active" : ""}`;

  return <nav className="bottom-nav">
    <NavLink to="/" className={navItemClass}><span className="nav-icon">⌂</span><span className="nav-label">Home</span></NavLink>
    <NavLink to="/search" className={navItemClass}><span className="nav-icon">⌕</span><span className="nav-label">Search</span></NavLink>
    <NavLink to="/following" className={navItemClass}>
      {profileImage ? <img className="bottom-profile-icon" src={profileImage} alt="My profile"/> : <span className="nav-icon">◉</span>}
      <span className="nav-label">Following</span>
    </NavLink>
    <NavLink to="/activity" className={navItemClass}><span className="nav-icon">♡</span><span className="nav-label">Activity</span></NavLink>
    <NavLink to="/profile" className={navItemClass}><span className="nav-icon">◉</span><span className="nav-label">Profile</span></NavLink>
  </nav>;
}
export default BottomNav;