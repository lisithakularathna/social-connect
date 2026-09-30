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
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAccount = async () => {
    try {
      const { data } = await api.get("/users/me");
      setAccount(data);
      setName(data?.name || "");
      setUsername(data?.username || "");
      setBio(data?.bio || "");
    } catch (error) { console.error("Unable to load account details", error); }
  };

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("darkMode", String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => { void loadAccount(); }, []);

  const logout = () => { localStorage.removeItem("accessToken"); navigate("/login"); };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("username", username);
      form.append("bio", bio);
      if (avatarFile) form.append("image", avatarFile);
      const { data } = await api.patch("/users/me", form);
      await loadAccount();
      setAvatarFile(null);
      setAvatarPreview("");
      alert(data?.message || "Profile updated successfully");
    } catch (error: any) {
      alert(error.response?.data?.message || "Could not update profile. Please try again.");
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword) return alert("Please fill both password fields");
    try {
      await api.post("/auth/change-password", { currentPassword: oldPassword, newPassword });
      alert("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to change password. Check your current password.");
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) => `sidebar-link ${isActive ? "active" : ""}`;
  const avatar = avatarPreview || account?.profileImageUrl;

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
          {account?.profileImageUrl ? <img className="sidebar-profile-icon" src={account.profileImageUrl} alt="Your profile" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="sidebar-icon">◉</span>} Profile
        </NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="more-menu-container">
          {showMore && <div className="more-dropdown">
            <button onClick={() => { void loadAccount(); setShowSettings(true); setShowMore(false); }}>⚙️ Settings</button>
            <button onClick={() => { setIsDarkMode(!isDarkMode); setShowMore(false); }}>{isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
            <button onClick={logout} className="logout-text">Log out</button>
          </div>}
          <button onClick={() => setShowMore(!showMore)} className="sidebar-link more-btn"><span className="sidebar-icon">☰</span> More</button>
        </div>
      </div>

      {showSettings && <div className="edit-overlay" onClick={() => setShowSettings(false)}>
        <div className="edit-modal settings-modal" onClick={e => e.stopPropagation()}>
          <div className="edit-header"><h2>Account settings</h2><button onClick={() => setShowSettings(false)} aria-label="Close settings">×</button></div>
          <div className="settings-account-card">
            <div className="settings-avatar">
              {avatar ? <img src={avatar} alt="Your profile preview" /> : <span>{(username || account?.email || "U")[0].toUpperCase()}</span>}
            </div>
            <div><strong>{username || "Your account"}</strong><p>{account?.email || "Account profile"}</p></div>
          </div>
          <div className="edit-form-group">
            <label htmlFor="settings-avatar">Profile photo</label>
            <input id="settings-avatar" type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0] || null;
              setAvatarFile(file);
              setAvatarPreview(file ? URL.createObjectURL(file) : "");
            }} />
          </div>
          <div className="edit-form-group">
            <label htmlFor="settings-name">Full name</label>
            <input id="settings-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={80} />
            <label htmlFor="settings-username">Username</label>
            <input id="settings-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" maxLength={30} />
            <label htmlFor="settings-email">Email</label>
            <input id="settings-email" value={account?.email || ""} readOnly />
            <label htmlFor="settings-bio">Bio</label>
            <textarea id="settings-bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about yourself" maxLength={150} rows={3} />
            <button className="sidebar-create-btn" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save profile changes"}</button>
          </div>
          <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "22px 0" }} />
          <div className="edit-form-group">
            <label>Appearance</label>
            <button className="sidebar-create-btn" style={{ width: "auto", padding: "10px 20px", background: "var(--input-bg)", color: "var(--text-primary)" }} onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}</button>
          </div>
          <hr style={{ border: "0", borderTop: "1px solid var(--border-color)", margin: "22px 0" }} />
          <div className="edit-form-group">
            <label>Change password</label>
            <input type="password" autoComplete="current-password" placeholder="Current password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            <input type="password" autoComplete="new-password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button className="sidebar-create-btn" onClick={handlePasswordChange}>Update password</button>
          </div>
        </div>
      </div>}
    </aside>
  );
}
export default Navbar;
