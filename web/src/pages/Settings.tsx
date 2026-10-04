import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import ConfirmModal from "../components/ConfirmModal";
import api from "../api/api";
import "./Settings.css";

interface Account {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

interface BlockedUser {
  id: number | string;
  username: string;
  name?: string;
  profileImageUrl?: string;
}

type TabType = "all" | "profile" | "privacy" | "blocked" | "muted" | "notifications" | "appearance" | "security";

function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<TabType>("all");

  // Profile data
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  // Password data
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Appearance
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );

  // Mobile-aligned Privacy Settings
  const [privateAccount, setPrivateAccount] = useState(
    () => localStorage.getItem("privateAccount") === "true"
  );
  const [activityStatus, setActivityStatus] = useState(
    () => localStorage.getItem("activityStatus") !== "false"
  );
  const [messagePrivacy, setMessagePrivacy] = useState(
    () => localStorage.getItem("messagePrivacy") || "Everyone"
  );
  const [storyPrivacy, setStoryPrivacy] = useState(
    () => localStorage.getItem("storyPrivacy") || "Everyone"
  );

  // Mobile-aligned Blocked & Muted Users
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(() => {
    try {
      const raw = localStorage.getItem("blockedUsers");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [mutedUsers, setMutedUsers] = useState<BlockedUser[]>(() => {
    try {
      const raw = localStorage.getItem("mutedUsers");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // User search for blocking
  const [searchBlockQuery, setSearchBlockQuery] = useState("");
  const [blockSearchResults, setBlockSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Mobile-aligned Notification Settings
  const [notifLikes, setNotifLikes] = useState(
    () => localStorage.getItem("notif_likes") !== "false"
  );
  const [notifComments, setNotifComments] = useState(
    () => localStorage.getItem("notif_comments") !== "false"
  );
  const [notifFollowers, setNotifFollowers] = useState(
    () => localStorage.getItem("notif_followers") !== "false"
  );
  const [notifMessages, setNotifMessages] = useState(
    () => localStorage.getItem("notif_messages") !== "false"
  );
  const [notifMentions, setNotifMentions] = useState(
    () => localStorage.getItem("notif_mentions") !== "false"
  );

  // Two-Factor Authentication
  const [twoFactorAuth, setTwoFactorAuth] = useState(
    () => localStorage.getItem("twoFactorAuth") === "true"
  );

  // Loading & feedback states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal dialogs
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

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

  // Handle Privacy Toggles
  const handleTogglePrivateAccount = (val: boolean) => {
    setPrivateAccount(val);
    localStorage.setItem("privateAccount", String(val));
    showToast(val ? "Account set to Private" : "Account set to Public");
  };

  const handleToggleActivityStatus = (val: boolean) => {
    setActivityStatus(val);
    localStorage.setItem("activityStatus", String(val));
    showToast(val ? "Activity status is now visible" : "Activity status hidden");
  };

  const handleChangeMessagePrivacy = (val: string) => {
    setMessagePrivacy(val);
    localStorage.setItem("messagePrivacy", val);
    showToast(`Messages allowed from: ${val}`);
  };

  const handleChangeStoryPrivacy = (val: string) => {
    setStoryPrivacy(val);
    localStorage.setItem("storyPrivacy", val);
    showToast(`Story replies: ${val}`);
  };

  // Search users to block
  useEffect(() => {
    const q = searchBlockQuery.trim();
    if (!q) {
      setBlockSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        setBlockSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setBlockSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchBlockQuery]);

  // Block a user
  const handleBlockUser = (user: any) => {
    const userId = user.id;
    if (!userId || blockedUsers.some((u) => String(u.id) === String(userId))) return;

    const newItem: BlockedUser = {
      id: userId,
      username: user.username || "user",
      name: user.name || "",
      profileImageUrl: user.profileImageUrl,
    };

    const updated = [...blockedUsers, newItem];
    setBlockedUsers(updated);
    localStorage.setItem("blockedUsers", JSON.stringify(updated));
    setSearchBlockQuery("");
    setBlockSearchResults([]);
    showToast(`@${newItem.username} blocked`);
  };

  // Unblock a user
  const handleUnblockUser = (userId: number | string) => {
    const target = blockedUsers.find((u) => String(u.id) === String(userId));
    const updated = blockedUsers.filter((u) => String(u.id) !== String(userId));
    setBlockedUsers(updated);
    localStorage.setItem("blockedUsers", JSON.stringify(updated));
    showToast(target ? `@${target.username} unblocked` : "User unblocked");
  };

  // Unmute a user
  const handleUnmuteUser = (userId: number | string) => {
    const target = mutedUsers.find((u) => String(u.id) === String(userId));
    const updated = mutedUsers.filter((u) => String(u.id) !== String(userId));
    setMutedUsers(updated);
    localStorage.setItem("mutedUsers", JSON.stringify(updated));
    showToast(target ? `@${target.username} unmuted` : "User unmuted");
  };

  // Handle Notifications Toggles
  const handleToggleNotif = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val);
    localStorage.setItem(key, String(val));
    showToast("Notification preferences updated");
  };

  // Handle Two-Factor
  const handleToggleTwoFactor = (val: boolean) => {
    setTwoFactorAuth(val);
    localStorage.setItem("twoFactorAuth", String(val));
    showToast(val ? "Two-Factor Authentication enabled" : "Two-Factor Authentication disabled");
  };

  // Save Profile
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
      showToast("Profile updated successfully");
    } catch (err: any) {
      setProfileMsg({
        type: "err",
        text: err.response?.data?.message || "Could not update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
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
      showToast("Password updated successfully");
    } catch (err: any) {
      setPasswordMsg({
        type: "err",
        text: err.response?.data?.message || "Failed to change password. Check your current password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  // Delete Account
  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await api.delete("/users/me");
      localStorage.clear();
      navigate("/register");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  const avatar = avatarPreview || account?.profileImageUrl;
  const initials = (username || account?.email || "U")[0].toUpperCase();

  const shouldShow = (section: TabType) => activeTab === "all" || activeTab === section;

  return (
    <>
      <Navbar />

      <main className="settings-page">
        {/* Page Header */}
        <div className="settings-page-header">
          <h1>Settings</h1>
          <p>Manage your account, privacy controls, blocked users, and preferences</p>
        </div>

        {/* Quick Category Filter Tabs */}
        <div className="settings-tabs-scroll" role="tablist">
          <button
            className={`settings-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Settings
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profile
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            🔒 Privacy
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "blocked" ? "active" : ""}`}
            onClick={() => setActiveTab("blocked")}
          >
            🚫 Blocked ({blockedUsers.length})
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "muted" ? "active" : ""}`}
            onClick={() => setActiveTab("muted")}
          >
            🔇 Muted ({mutedUsers.length})
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            🔔 Notifications
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            🎨 Appearance
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            🛡️ Security
          </button>
        </div>

        {/* ── 1. Profile section ── */}
        {shouldShow("profile") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Public Profile</h2>
                <p>Customize your identity visible to others across Social Connect</p>
              </div>
              <span className="settings-section-badge">Account</span>
            </div>

            {/* Avatar Row */}
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
                {savingProfile ? "Saving…" : "Save profile changes"}
              </button>
            </div>
          </section>
        )}

        {/* ── 2. Privacy & Interactions (Matching Mobile) ── */}
        {shouldShow("privacy") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Privacy & Content Controls</h2>
                <p>Control who sees your content, active status, and messages</p>
              </div>
              <span className="settings-section-badge">Privacy</span>
            </div>

            {/* Private Account */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Private Account</span>
                <span className="settings-row-desc">
                  {privateAccount
                    ? "Only approved followers can see your profile, posts, and stories."
                    : "Anyone can view your public posts, profile, and stories."}
                </span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={privateAccount}
                  onChange={(e) => handleTogglePrivateAccount(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* Activity Status */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Activity Status</span>
                <span className="settings-row-desc">
                  Allow accounts you follow and anyone you message to see when you are currently online or last active.
                </span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={activityStatus}
                  onChange={(e) => handleToggleActivityStatus(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* Message Privacy */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Direct Message Privacy</span>
                <span className="settings-row-desc">
                  Choose who can send you direct chat requests and messages.
                </span>
              </div>
              <select
                className="settings-select-custom"
                value={messagePrivacy}
                onChange={(e) => handleChangeMessagePrivacy(e.target.value)}
              >
                <option value="Everyone">Everyone</option>
                <option value="Followers">Followers only</option>
                <option value="No one">No one</option>
              </select>
            </div>

            {/* Story Privacy */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Story Replies</span>
                <span className="settings-row-desc">
                  Choose who can send interactive message reactions and replies to your stories.
                </span>
              </div>
              <select
                className="settings-select-custom"
                value={storyPrivacy}
                onChange={(e) => handleChangeStoryPrivacy(e.target.value)}
              >
                <option value="Everyone">Everyone</option>
                <option value="People you follow">People you follow</option>
                <option value="Off">Turn off</option>
              </select>
            </div>
          </section>
        )}

        {/* ── 3. Blocked Accounts (Matching Mobile) ── */}
        {shouldShow("blocked") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Blocked Accounts</h2>
                <p>
                  Blocked people cannot view your profile, posts, or message you on Social Connect.
                </p>
              </div>
              <span className="settings-section-badge">{blockedUsers.length} Blocked</span>
            </div>

            {/* Search to block */}
            <div className="settings-search-bar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchBlockQuery}
                onChange={(e) => setSearchBlockQuery(e.target.value)}
                placeholder="Search username to block..."
              />
              {isSearchingUsers && <small style={{ color: "var(--accent)" }}>Searching…</small>}
            </div>

            {/* Search Results */}
            {blockSearchResults.length > 0 && (
              <div className="settings-user-list">
                <small style={{ fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  SEARCH RESULTS
                </small>
                {blockSearchResults.map((u) => {
                  const isAlreadyBlocked = blockedUsers.some((b) => String(b.id) === String(u.id));
                  return (
                    <div key={u.id} className="settings-user-card">
                      <div className="settings-user-meta">
                        {u.profileImageUrl ? (
                          <img className="settings-user-avatar" src={u.profileImageUrl} alt={u.username} />
                        ) : (
                          <div className="settings-user-avatar">
                            {u.username?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                        <div className="settings-user-names">
                          <strong>{u.name || u.username}</strong>
                          <small>@{u.username}</small>
                        </div>
                      </div>
                      {isAlreadyBlocked ? (
                        <button className="settings-btn-outline" onClick={() => handleUnblockUser(u.id)}>
                          Unblock
                        </button>
                      ) : (
                        <button className="settings-btn-danger-outline" onClick={() => handleBlockUser(u)}>
                          Block
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Blocked Users List */}
            {blockedUsers.length === 0 ? (
              <div className="settings-empty-notice">
                <p>You haven&apos;t blocked any accounts yet.</p>
              </div>
            ) : (
              <div className="settings-user-list">
                {blockedUsers.map((user) => (
                  <div key={user.id} className="settings-user-card">
                    <div className="settings-user-meta">
                      {user.profileImageUrl ? (
                        <img className="settings-user-avatar" src={user.profileImageUrl} alt={user.username} />
                      ) : (
                        <div className="settings-user-avatar">
                          {user.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="settings-user-names">
                        <strong>{user.name || user.username}</strong>
                        <small>@{user.username}</small>
                      </div>
                    </div>
                    <button
                      className="settings-btn-outline"
                      onClick={() => handleUnblockUser(user.id)}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 4. Muted Accounts (Matching Mobile) ── */}
        {shouldShow("muted") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Muted Accounts</h2>
                <p>Posts and stories from muted accounts won&apos;t show up in your feed</p>
              </div>
              <span className="settings-section-badge">{mutedUsers.length} Muted</span>
            </div>

            {mutedUsers.length === 0 ? (
              <div className="settings-empty-notice">
                <p>No muted accounts. You can mute people from their profile page.</p>
              </div>
            ) : (
              <div className="settings-user-list">
                {mutedUsers.map((user) => (
                  <div key={user.id} className="settings-user-card">
                    <div className="settings-user-meta">
                      {user.profileImageUrl ? (
                        <img className="settings-user-avatar" src={user.profileImageUrl} alt={user.username} />
                      ) : (
                        <div className="settings-user-avatar">
                          {user.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="settings-user-names">
                        <strong>{user.name || user.username}</strong>
                        <small>@{user.username}</small>
                      </div>
                    </div>
                    <button
                      className="settings-btn-outline"
                      onClick={() => handleUnmuteUser(user.id)}
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 5. Notification Preferences (Matching Mobile) ── */}
        {shouldShow("notifications") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Push & In-App Notifications</h2>
                <p>Choose what activity triggers alerts and notifications</p>
              </div>
              <span className="settings-section-badge">Alerts</span>
            </div>

            {/* Likes */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Post Likes</span>
                <span className="settings-row-desc">Notify when someone likes your photo or video post</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notifLikes}
                  onChange={(e) => handleToggleNotif("notif_likes", e.target.checked, setNotifLikes)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* Comments */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Comments</span>
                <span className="settings-row-desc">Notify when someone comments on your post or replies to you</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notifComments}
                  onChange={(e) => handleToggleNotif("notif_comments", e.target.checked, setNotifComments)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* New Followers */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">New Followers</span>
                <span className="settings-row-desc">Notify when another user follows your account</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notifFollowers}
                  onChange={(e) => handleToggleNotif("notif_followers", e.target.checked, setNotifFollowers)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* Messages */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Direct Messages</span>
                <span className="settings-row-desc">Notify for incoming direct chats and message requests</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notifMessages}
                  onChange={(e) => handleToggleNotif("notif_messages", e.target.checked, setNotifMessages)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

            {/* Mentions */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Tags & Mentions</span>
                <span className="settings-row-desc">Notify when someone mentions @{username || "you"} in a caption or story</span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notifMentions}
                  onChange={(e) => handleToggleNotif("notif_mentions", e.target.checked, setNotifMentions)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>
          </section>
        )}

        {/* ── 6. Appearance section ── */}
        {shouldShow("appearance") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Appearance & Theme</h2>
                <p>Customize the color scheme and visual comfort of your interface</p>
              </div>
              <span className="settings-section-badge">Theme</span>
            </div>

            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">{isDarkMode ? "Dark Theme Active" : "Light Theme Active"}</span>
                <span className="settings-row-desc">Switch seamlessly between sleek dark mode and vibrant light mode</span>
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
        )}

        {/* ── 7. Password & Security section ── */}
        {shouldShow("security") && (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-title-wrap">
                <h2>Password & Account Security</h2>
                <p>Keep your account protected with strong authentication</p>
              </div>
              <span className="settings-section-badge">Security</span>
            </div>

            {/* 2FA Toggle */}
            <div className="settings-row-item">
              <div className="settings-row-info">
                <span className="settings-row-title">Two-Factor Authentication (2FA)</span>
                <span className="settings-row-desc">
                  Add an extra layer of security when signing into your account from new browsers.
                </span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={twoFactorAuth}
                  onChange={(e) => handleToggleTwoFactor(e.target.checked)}
                />
                <span className="settings-switch-slider" />
              </label>
            </div>

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
                  placeholder="Enter your current password"
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
        )}

        {/* ── 8. Danger Zone / Actions ── */}
        <section className="settings-section settings-section-danger">
          <div className="settings-section-head">
            <div className="settings-section-title-wrap">
              <h2>Account Session & Actions</h2>
              <p>Log out of this session or manage permanent account deletion</p>
            </div>
            <span className="settings-section-badge" style={{ color: "#ef4444", background: "rgba(239,68,68,0.12)" }}>
              Danger
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <button className="settings-logout-btn" onClick={logout}>
              Log out
            </button>
            <button
              className="settings-btn-danger-outline"
              style={{ padding: "12px 20px", borderRadius: "10px" }}
              onClick={() => setShowDeleteModal(true)}
            >
              Permanently Delete Account
            </button>
          </div>
        </section>
      </main>

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Account?"
        message="Are you sure you want to permanently delete your Social Connect account? All your posts, photos, and messages will be permanently erased. This action cannot be undone."
        confirmText="Yes, Delete My Account"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeletingAccount}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Toast notification pill */}
      {toastMessage && (
        <div className="settings-toast" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      <BottomNav />
    </>
  );
}

export default Settings;
