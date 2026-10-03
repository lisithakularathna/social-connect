import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadAccount = async () => {
    try {
      const { data } = await api.get("/users/me");
      setAccount(data);
      setName(data?.name || "");
      setUsername(data?.username || "");
      setBio(data?.bio || "");
    } catch {
      /* ignore */
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
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const form = new FormData();
      form.append("name", name);
      form.append("username", username);
      form.append("bio", bio);
      if (avatarFile) form.append("image", avatarFile);
      await api.patch("/users/me", form);
      await loadAccount();
      setAvatarFile(null);
      setAvatarPreview("");
      setProfileMsg({ type: "ok", text: "Profile updated successfully." });
    } catch (err: any) {
      setProfileMsg({
        type: "err",
        text: err.response?.data?.message || "Could not update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!oldPassword || !newPassword)
      return setPasswordMsg({ type: "err", text: "Please fill in both password fields." });
    if (newPassword !== confirmPassword)
      return setPasswordMsg({ type: "err", text: "New passwords do not match." });
    if (newPassword.length < 6)
      return setPasswordMsg({ type: "err", text: "Password must be at least 6 characters." });

    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await api.post("/auth/change-password", {
        currentPassword: oldPassword,
        newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "ok", text: "Password changed successfully." });
    } catch (err: any) {
      setPasswordMsg({
        type: "err",
        text: err.response?.data?.message || "Failed to change password. Check your current password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  const avatar = avatarPreview || account?.profileImageUrl;
  const initials = (username || account?.email || "U")[0].toUpperCase();

  return (
    <>
      <Navbar />

      <main className="settings-page">
        {/* ── Page header ── */}
        <div className="settings-page-header">
          <h1>Settings</h1>
          <p>Manage your profile and account preferences</p>
        </div>

        {/* ── Profile section ── */}
        <section className="settings-section">
          <div className="settings-section-label">Profile</div>

          {/* Avatar */}
          <div className="settings-avatar-row">
            <div
              className="settings-avatar-large"
              onClick={() => fileInputRef.current?.click()}
              title="Change profile photo"
            >
              {avatar ? (
                <img src={avatar} alt="Your avatar" />
              ) : (
                <span>{initials}</span>
              )}
              <div className="settings-avatar-overlay">
                <span>📷</span>
              </div>
            </div>
            <div className="settings-avatar-meta">
              <strong>{username || account?.email || "Your account"}</strong>
              <small>{account?.email}</small>
              <button
                className="settings-link-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Change profile photo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setAvatarFile(file);
                setAvatarPreview(file ? URL.createObjectURL(file) : "");
              }}
            />
          </div>

          {profileMsg && (
            <div className={`settings-msg ${profileMsg.type}`}>{profileMsg.text}</div>
          )}

          <div className="settings-form">
            <div className="settings-field">
              <label htmlFor="s-name">Full name</label>
              <input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                maxLength={80}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="s-username">Username</label>
              <input
                id="s-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                maxLength={30}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="s-email">Email</label>
              <input
                id="s-email"
                value={account?.email || ""}
                readOnly
                style={{ opacity: 0.6 }}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="s-bio">Bio</label>
              <textarea
                id="s-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself"
                maxLength={150}
                rows={3}
              />
            </div>
            <button
              className="settings-save-btn"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </section>

        {/* ── Appearance section ── */}
        <section className="settings-section">
          <div className="settings-section-label">Appearance</div>
          <div className="settings-appearance-row">
            <div>
              <strong>{isDarkMode ? "Dark Mode" : "Light Mode"}</strong>
              <p>Switch between light and dark theme</p>
            </div>
            <button
              className={`settings-toggle ${isDarkMode ? "on" : "off"}`}
              onClick={() => setIsDarkMode((v) => !v)}
              aria-label="Toggle dark mode"
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        </section>

        {/* ── Password section ── */}
        <section className="settings-section">
          <div className="settings-section-label">Change Password</div>

          {passwordMsg && (
            <div className={`settings-msg ${passwordMsg.type}`}>{passwordMsg.text}</div>
          )}

          <div className="settings-form">
            <div className="settings-field">
              <label htmlFor="s-old-pw">Current password</label>
              <input
                id="s-old-pw"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="s-new-pw">New password</label>
              <input
                id="s-new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="s-confirm-pw">Confirm new password</label>
              <input
                id="s-confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <button
              className="settings-save-btn"
              onClick={changePassword}
              disabled={savingPassword}
            >
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </div>
        </section>

        {/* ── Danger section ── */}
        <section className="settings-section settings-section-danger">
          <div className="settings-section-label">Account</div>
          <button className="settings-logout-btn" onClick={logout}>
            Log out
          </button>
        </section>
      </main>

      <BottomNav />
    </>
  );
}

export default Settings;
