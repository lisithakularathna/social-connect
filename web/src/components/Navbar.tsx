import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api/api";

interface Account {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

function Navbar() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [account, setAccount] = useState<Account | null>(null);
  const [showMore, setShowMore] = useState(false);

  const loadAccount = async () => {
    try {
      const { data } = await api.get("/users/me");
      setAccount(data);
    } catch (error) { console.error("Unable to load account details", error); }
  };

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("darkMode", String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => { void loadAccount(); }, []);

  const logout = () => { localStorage.removeItem("accessToken"); navigate("/login"); };

  const navItemClass = ({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? "active" : ""}`;

  return (
    <aside className="left-sidebar">
      <div className="sidebar-logo" onClick={() => navigate("/")}>Social Connect</div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={navItemClass}><span className="sidebar-icon">⌂</span> Home</NavLink>
        <NavLink to="/search" className={navItemClass}><span className="sidebar-icon">⌕</span> Search</NavLink>
        <NavLink to="/messages" className={navItemClass}><span className="sidebar-icon">✉</span> Messages</NavLink>
        <NavLink to="/activity" className={navItemClass}><span className="sidebar-icon">♡</span> Notifications</NavLink>
        <NavLink to="/create" className={navItemClass}><span className="sidebar-icon">＋</span> Create</NavLink>
        <NavLink to="/profile" className={navItemClass}>
          {account?.profileImageUrl
            ? <img className="sidebar-profile-icon" src={account.profileImageUrl} alt="Your profile" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            : <span className="sidebar-icon">◉</span>}
          {" "}Profile
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div className="more-menu-container">
          {showMore && (
            <div className="more-dropdown">
              <button onClick={() => { navigate("/settings"); setShowMore(false); }}>⚙️ Settings</button>
              <button onClick={() => { setIsDarkMode(!isDarkMode); setShowMore(false); }}>
                {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
              <button onClick={logout} className="logout-text">Log out</button>
            </div>
          )}
          <button onClick={() => setShowMore(!showMore)} className="sidebar-link more-btn">
            <span className="sidebar-icon">☰</span> More
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Navbar;
