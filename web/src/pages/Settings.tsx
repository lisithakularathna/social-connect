import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

interface Account {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

function Settings() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
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
    } catch (error) {
      console.error("Unable to load account details", error);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("darkMode", String(isDarkMode));
  }, [isDarkMode]);

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
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword) {
      alert("Please fill both password fields");
      return;
    }

    try {
      await api.post("/auth/change-password", {
        currentPassword: oldPassword,
        newPassword,
      });
      alert("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to change password. Check your current password.");
    }
  };

  const avatar = avatarPreview || account?.profileImageUrl;

  return (
    <>
      <Navbar />

      <main className="settings-page">
        <div className="settings-content">
          <header className="settings-page-header">
            <h1>Settings</h1>
            <p>Manage your account, profile and security.</p>
          </header>

          <section className="settings-card">
            <div className="settings-section-title">
              <h2>Account</h2>
              <p>Your profile information</p>
            </div>

            <div className="settings-account-card">
              <div className="settings-avatar">
                {avatar
                  ? <img src={avatar} alt="Your profile preview" />
                  : <span>{(username || account?.email || "U")[0].toUpperCase()}</span>}
              </div>
              <div>
                <strong>{username || "Your account"}</strong>
                <p>{account?.email || "Account profile"}</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <div className="edit-form-group">
                <label htmlFor="settings-avatar">Profile photo</label>
                <input
                  id="settings-avatar"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAvatarFile(file);
                    setAvatarPreview(file ? URL.createObjectURL(file) : "");
                  }}
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="settings-name">Full name</label>
                <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} />
              </div>

              <div className="edit-form-group">
                <label htmlFor="settings-username">Username</label>
                <input id="settings-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" maxLength={30} />
              </div>

              <div className="edit-form-group">
                <label htmlFor="settings-email">Email</label>
                <input id="settings-email" value={account?.email || ""} readOnly />
              </div>
            </div>

            <div className="edit-form-group">
              <label htmlFor="settings-bio">Bio</label>
              <textarea id="settings-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself" maxLength={150} rows={4} />
            </div>

            <button className="settings-primary-btn" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save profile changes"}
            </button>
          </section>

          <section className="settings-card">
            <div className="settings-section-title">
              <h2>Appearance</h2>
              <p>Choose how Social Connect looks for you.</p>
            </div>
            <button className="settings-secondary-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
            </button>
          </section>

          <section className="settings-card">
            <div className="settings-section-title">
              <h2>Security</h2>
              <p>Update your account password.</p>
            </div>
            <div className="settings-password-row">
              <input type="password" autoComplete="current-password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
              <input type="password" autoComplete="new-password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button className="settings-primary-btn" onClick={handlePasswordChange}>Update password</button>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

export default Settings;
