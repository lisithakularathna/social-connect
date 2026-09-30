import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api/api";

function Navbar() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [profileImage, setProfileImage] = useState<string | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "true");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "false");
    }
  }, [isDarkMode]);

  useEffect(() => { 
    api.get("/users/me").then(r => setProfileImage(r.data?.profileImageUrl)).catch(() => {}); 
  }, []);

  const logout = () => { localStorage.removeItem("accessToken"); navigate("/login"); };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword) return alert("Please fill both password fields");
    try {
      await api.post("/auth/change-password", { currentPassword: oldPassword, newPassword });
      alert("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (e) {
      alert("Failed to change password. Please check your current password.");
    }
  };

  const [showMore, setShowMore] = useState(false);

  const navItemClass = ({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? "active" : ""}`;

  return (
    <aside className="left-sidebar">
      <div className="sidebar-logo" onClick={() => navigate("/")}>Social Connect</div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={navItemClass}><span className="sidebar-icon">⌂</span> Home</NavLink>
        <NavLink to="/search" className={navItemClass}><span className="sidebar-icon">⌕</span> Search</NavLink>
        <NavLink to="#" onClick={(e) => { e.preventDefault(); alert("Reels coming soon!"); }} className="sidebar-link"><span className="sidebar-icon">🎬</span> Reels</NavLink>
        <NavLink to="/messages" className={navItemClass}><span className="sidebar-icon">✉</span> Messages</NavLink>
        <NavLink to="/activity" className={navItemClass}><span className="sidebar-icon">♡</span> Notifications</NavLink>
        <NavLink to="/create" className={navItemClass}><span className="sidebar-icon">＋</span> Create</NavLink>
        <NavLink to="/profile" className={navItemClass}>
          {profileImage ? <img className="sidebar-profile-icon" src={profileImage} alt="Profile"/> : <span className="sidebar-icon">◉</span>} 
          Profile
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div className="more-menu-container">
          {showMore && (
            <div className="more-dropdown">
              <button onClick={() => { setShowSettings(true); setShowMore(false); }}>
                <span style={{ marginRight: '8px' }}>⚙️</span> Settings
              </button>
              <button onClick={() => { setIsDarkMode(!isDarkMode); setShowMore(false); }}>
                {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
              <button onClick={logout} className="logout-text">Log out</button>
            </div>
          )}
          <button onClick={() => setShowMore(!showMore)} className="sidebar-link more-btn">
            <span className="sidebar-icon">☰</span> More
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="edit-overlay" onClick={() => setShowSettings(false)}>
          <div className="edit-modal settings-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-header">
              <h2>Settings</h2>
              <button onClick={() => setShowSettings(false)}>×</button>
            </div>
            
            <div className="edit-form-group">
              <label>Theme</label>
              <button className="sidebar-create-btn" style={{ width: 'auto', padding: '10px 20px', background: 'var(--input-bg)', color: 'var(--text-primary)' }} onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </button>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

            <div className="edit-form-group">
              <label>Change Password</label>
              <input type="password" placeholder="Current Password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
              <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <button className="sidebar-create-btn" onClick={handlePasswordChange}>Update Password</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Navbar;