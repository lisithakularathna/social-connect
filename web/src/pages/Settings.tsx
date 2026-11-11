import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import ConfirmModal from "../components/ConfirmModal";
import UserAvatar from "../components/UserAvatar";
import api, { getErrorMessage } from "../api/api";
import { showGlobalToast } from "../utils/toast";
import { clearSession, refreshCurrentUser, setSessionToken } from "../utils/session";
import {
  ACCENTS,
  type ListedUser,
  type ThemeMode,
  blockUser,
  fetchBlockedUsers,
  fetchMutedUsers,
  getAccent,
  getHiddenWords,
  getReduceMotion,
  getThemeMode,
  setAccent,
  setHiddenWords,
  setReduceMotion,
  setThemeMode,
  unblockUser,
  unmuteUser,
} from "../utils/prefs";
import "./Settings.css";

interface Account {
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

interface ServerSettings {
  email: string;
  createdAt?: string;
  isPrivate: boolean;
  messagePrivacy: "everyone" | "followers" | "nobody";
  commentPrivacy: "everyone" | "followers" | "off";
  showActivityStatus: boolean;
  hideLikeCounts: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyMessages: boolean;
  notifyMentions: boolean;
  twoFactorEnabled: boolean;
}

type TabType =
  | "all"
  | "profile"
  | "account"
  | "privacy"
  | "safety"
  | "notifications"
  | "appearance"
  | "security"
  | "data";

const TABS: { key: TabType; label: string }[] = [
  { key: "all", label: "All settings" },
  { key: "profile", label: "👤 Profile" },
  { key: "account", label: "✉️ Account" },
  { key: "privacy", label: "🔒 Privacy" },
  { key: "safety", label: "🛡️ Safety" },
  { key: "notifications", label: "🔔 Notifications" },
  { key: "appearance", label: "🎨 Appearance" },
  { key: "security", label: "🔑 Security" },
  { key: "data", label: "📦 Your data" },
];

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`settings-switch ${disabled ? "is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="settings-switch-slider" />
    </label>
  );
}

function SectionHead({ title, desc, badge }: { title: string; desc: string; badge?: string }) {
  return (
    <div className="settings-section-head">
      <div className="settings-section-title-wrap">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      {badge && <span className="settings-section-badge">{badge}</span>}
    </div>
  );
}

function Row({
  title,
  desc,
  children,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row-item">
      <div className="settings-row-info">
        <span className="settings-row-title">{title}</span>
        {desc && <span className="settings-row-desc">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  // ── Profile ──
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Server settings ──
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  // ── Safety ──
  const [blockedUsers, setBlockedUsers] = useState<ListedUser[]>([]);
  const [mutedUsers, setMutedUsers] = useState<ListedUser[]>([]);
  const [blockQuery, setBlockQuery] = useState("");
  const [blockResults, setBlockResults] = useState<ListedUser[]>([]);
  const [hiddenWords, setHiddenWordsState] = useState<string[]>(() => getHiddenWords());
  const [newWord, setNewWord] = useState("");

  // ── Appearance (this device) ──
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode());
  const [accent, setAccentState] = useState(() => getAccent());
  const [reduceMotion, setReduceMotionState] = useState(() => getReduceMotion());

  // ── Account / security ──
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [twoFactor, setTwoFactor] = useState<{ enabled: boolean; recoveryCodesRemaining: number }>({
    enabled: false,
    recoveryCodesRemaining: 0,
  });
  const [tfaStep, setTfaStep] = useState<"idle" | "scan" | "codes" | "disable">("idle");
  const [tfaSecret, setTfaSecret] = useState("");
  const [tfaQr, setTfaQr] = useState("");
  const [tfaCode, setTfaCode] = useState("");
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAll = async () => {
    try {
      const [me, s, blocked, muted, tfa, requests] = await Promise.all([
        api.get("/users/me"),
        api.get("/users/me/settings"),
        fetchBlockedUsers().catch(() => []),
        fetchMutedUsers().catch(() => []),
        api.get("/auth/2fa").catch(() => ({ data: { enabled: false, recoveryCodesRemaining: 0 } })),
        api.get("/follows/requests").catch(() => ({ data: [] })),
      ]);
      setAccount(me.data);
      setName(me.data?.name || "");
      setUsername(me.data?.username || "");
      setBio(me.data?.bio || "");
      setSettings(s.data);
      setBlockedUsers(blocked);
      setMutedUsers(muted);
      setTwoFactor(tfa.data);
      setRequestCount(Array.isArray(requests.data) ? requests.data.length : 0);
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't load your settings"));
    }
  };

  useEffect(() => {
    // State is only set after the awaited requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, []);

  // Debounced user search for blocking.
  useEffect(() => {
    const q = blockQuery.trim();
    if (!q) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        setBlockResults(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch {
        setBlockResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [blockQuery]);

  // ── Server setting updates (optimistic) ──
  const updateSetting = async <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    try {
      const { data } = await api.patch("/users/me/settings", { [key]: value });
      setSettings(data);
      if (key === "isPrivate" && value === false && data.approvedRequests > 0) {
        showGlobalToast(`${data.approvedRequests} pending follow request(s) were approved`);
        setRequestCount(0);
      } else {
        showGlobalToast("Saved");
      }
    } catch (err) {
      setSettings(previous);
      showGlobalToast(getErrorMessage(err, "Couldn't save that setting"));
    }
  };

  // ── Profile ──
  const saveProfile = async () => {
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim())) {
      setProfileMsg({ type: "err", text: 'Username must be 3-30 characters: letters, numbers, "_" or "."' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("username", username.trim());
      form.append("bio", bio.trim());
      if (avatarFile) form.append("image", avatarFile);
      const { data } = await api.patch("/users/me", form);
      setAccount((a) => ({ ...a, ...data.user }));
      setAvatarFile(null);
      setAvatarPreview("");
      void refreshCurrentUser();
      setProfileMsg({ type: "ok", text: "Profile updated." });
    } catch (err) {
      setProfileMsg({ type: "err", text: getErrorMessage(err, "Could not update profile.") });
    } finally {
      setSavingProfile(false);
    }
  };

  const removeAvatar = async () => {
    try {
      await api.delete("/users/me/avatar");
      setAccount((a) => ({ ...a, profileImageUrl: undefined }));
      setAvatarFile(null);
      setAvatarPreview("");
      void refreshCurrentUser();
      showGlobalToast("Profile photo removed");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't remove photo"));
    }
  };

  // ── Account ──
  const changeEmail = async () => {
    setEmailBusy(true);
    setEmailError(null);
    try {
      const { data } = await api.patch("/auth/email", { email: newEmail.trim(), password: emailPassword });
      setSettings((s) => (s ? { ...s, email: data.email } : s));
      setAccount((a) => ({ ...a, email: data.email }));
      setShowEmailModal(false);
      setNewEmail("");
      setEmailPassword("");
      showGlobalToast("Email updated");
    } catch (err) {
      setEmailError(getErrorMessage(err, "Couldn't change email"));
    } finally {
      setEmailBusy(false);
    }
  };

  // ── Safety ──
  const handleBlock = async (user: ListedUser) => {
    try {
      await blockUser(user.id);
      setBlockedUsers((list) => [user, ...list.filter((u) => u.id !== user.id)]);
      setBlockQuery("");
      setBlockResults([]);
      showGlobalToast(`Blocked @${user.username}`);
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't block"));
    }
  };

  const handleUnblock = async (user: ListedUser) => {
    try {
      await unblockUser(user.id);
      setBlockedUsers((list) => list.filter((u) => u.id !== user.id));
      showGlobalToast(`Unblocked @${user.username}`);
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't unblock"));
    }
  };

  const handleUnmute = async (user: ListedUser) => {
    try {
      await unmuteUser(user.id);
      setMutedUsers((list) => list.filter((u) => u.id !== user.id));
      showGlobalToast(`Unmuted @${user.username}`);
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't unmute"));
    }
  };

  const addHiddenWord = () => {
    const word = newWord.trim();
    if (!word) return;
    setHiddenWordsState(setHiddenWords([...hiddenWords, word]));
    setNewWord("");
  };

  // ── Security ──
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
      const { data } = await api.post("/auth/change-password", {
        currentPassword: oldPassword,
        newPassword,
      });
      // Changing the password signs out other devices; keep this one signed in.
      if (data?.accessToken) setSessionToken(data.accessToken);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "ok", text: "Password changed. Other devices were signed out." });
    } catch (err) {
      setPasswordMsg({
        type: "err",
        text: getErrorMessage(err, "Failed to change password. Check your current password."),
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const startTwoFactor = async () => {
    setTfaBusy(true);
    setTfaError(null);
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setTfaSecret(data.secret);
      // Loaded on demand so the QR library isn't in the main bundle.
      const { default: QRCode } = await import("qrcode");
      setTfaQr(await QRCode.toDataURL(data.otpauthUrl, { width: 220, margin: 1 }));
      setTfaCode("");
      setTfaStep("scan");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't start setup"));
    } finally {
      setTfaBusy(false);
    }
  };

  const confirmTwoFactor = async () => {
    setTfaBusy(true);
    setTfaError(null);
    try {
      const { data } = await api.post("/auth/2fa/enable", { code: tfaCode });
      setRecoveryCodes(data.recoveryCodes || []);
      setTwoFactor({ enabled: true, recoveryCodesRemaining: (data.recoveryCodes || []).length });
      setSettings((s) => (s ? { ...s, twoFactorEnabled: true } : s));
      setTfaStep("codes");
    } catch (err) {
      setTfaError(getErrorMessage(err, "That code didn't match"));
    } finally {
      setTfaBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    setTfaBusy(true);
    setTfaError(null);
    try {
      await api.post("/auth/2fa/disable", { password: tfaPassword, code: tfaCode });
      setTwoFactor({ enabled: false, recoveryCodesRemaining: 0 });
      setSettings((s) => (s ? { ...s, twoFactorEnabled: false } : s));
      setTfaStep("idle");
      setTfaPassword("");
      setTfaCode("");
      showGlobalToast("Two-factor authentication is off");
    } catch (err) {
      setTfaError(getErrorMessage(err, "Couldn't turn off 2FA"));
    } finally {
      setTfaBusy(false);
    }
  };

  const downloadText = (filename: string, text: string, type = "text/plain") => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const logoutAllDevices = async () => {
    setLoggingOutAll(true);
    try {
      const { data } = await api.post("/auth/logout-all");
      if (data?.accessToken) setSessionToken(data.accessToken);
      setShowLogoutAll(false);
      showGlobalToast("Signed out of all other devices");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't sign out other devices"));
    } finally {
      setLoggingOutAll(false);
    }
  };

  // ── Data ──
  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/users/me/export");
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`social-connect-${account?.username || "data"}-${date}.json`, JSON.stringify(data, null, 2), "application/json");
      showGlobalToast("Your data is downloading");
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Couldn't export your data"));
    } finally {
      setExporting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await api.delete("/users/me");
      clearSession();
      localStorage.clear();
      navigate("/register", { replace: true });
    } catch (err) {
      showGlobalToast(getErrorMessage(err, "Failed to delete account. Please try again."));
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const shouldShow = (section: TabType) => activeTab === "all" || activeTab === section;
  const avatar = avatarPreview || account?.profileImageUrl;
  const joined = settings?.createdAt
    ? new Date(settings.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : null;

  return (
    <>
      <Navbar />

      <main className="settings-page">
        <div className="settings-page-header">
          <h1>Settings</h1>
          <p>Your account, privacy, safety and preferences — synced across web and mobile.</p>
        </div>

        <div className="settings-tabs-scroll" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              className={`settings-tab-btn ${activeTab === t.key ? "active" : ""}`}
              onClick={(e) => {
                setActiveTab(t.key);
                e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!settings && (
          <section className="settings-section" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="sc-skel" style={{ height: 18, width: `${80 - i * 12}%` }} />
            ))}
          </section>
        )}

        {/* ── Profile ── */}
        {settings && shouldShow("profile") && (
          <section className="settings-section">
            <SectionHead title="Public profile" desc="How people see you across Social Connect." badge="Profile" />

            <div className="settings-avatar-row">
              <div
                className="settings-avatar-large"
                onClick={() => fileInputRef.current?.click()}
                title="Change profile photo"
              >
                {avatar ? <img src={avatar} alt="Your avatar" /> : <span>{(username || "U")[0].toUpperCase()}</span>}
                <div className="settings-avatar-overlay">📷</div>
              </div>
              <div className="settings-avatar-meta">
                <strong>{account?.username}</strong>
                <small>{account?.email}</small>
                <div className="sc-inline-actions">
                  <button className="settings-link-btn" onClick={() => fileInputRef.current?.click()}>
                    Change photo
                  </button>
                  {account?.profileImageUrl && !avatarPreview && (
                    <button className="settings-link-btn sc-danger-link" onClick={() => void removeAvatar()}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    showGlobalToast("Image must be smaller than 10MB");
                    return;
                  }
                  setAvatarFile(file);
                  setAvatarPreview(URL.createObjectURL(file));
                }}
              />
            </div>

            {profileMsg && <div className={`settings-msg ${profileMsg.type}`}>{profileMsg.text}</div>}

            <div className="settings-form">
              <div className="settings-field">
                <label htmlFor="s-name">Name</label>
                <input id="s-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="settings-field">
                <label htmlFor="s-username">Username</label>
                <input
                  id="s-username"
                  value={username}
                  maxLength={30}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                />
              </div>
              <div className="settings-field">
                <label htmlFor="s-bio">
                  Bio <span className="sc-char-count">{bio.length}/300</span>
                </label>
                <textarea id="s-bio" rows={3} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              <button className="settings-save-btn" onClick={() => void saveProfile()} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </div>
          </section>
        )}

        {/* ── Account ── */}
        {settings && shouldShow("account") && (
          <section className="settings-section">
            <SectionHead title="Account" desc="Sign-in details for your account." badge="Account" />
            <Row title="Email address" desc={settings.email}>
              <button className="settings-btn-outline" onClick={() => setShowEmailModal(true)}>
                Change
              </button>
            </Row>
            {joined && (
              <Row title="Member since" desc={joined}>
                <span className="sc-muted-text">🎉</span>
              </Row>
            )}
            <Row title="Profile link" desc={`${window.location.origin}/u/${account?.username ?? ""}`}>
              <button
                className="settings-btn-outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}/u/${account?.username ?? ""}`);
                  showGlobalToast("Profile link copied");
                }}
              >
                Copy
              </button>
            </Row>
          </section>
        )}

        {/* ── Privacy ── */}
        {settings && shouldShow("privacy") && (
          <section className="settings-section">
            <SectionHead title="Privacy" desc="Control who can see and interact with you." badge="Privacy" />

            <Row
              title="Private account"
              desc={
                settings.isPrivate
                  ? "Only people you approve can see your posts, followers and following."
                  : "Anyone can see your posts. Turn on to approve followers first."
              }
            >
              <Toggle
                label="Private account"
                checked={settings.isPrivate}
                onChange={(v) => void updateSetting("isPrivate", v)}
              />
            </Row>
            {settings.isPrivate && (
              <Row title="Follow requests" desc={requestCount ? `${requestCount} waiting for you` : "No pending requests"}>
                <button className="settings-btn-outline" onClick={() => navigate("/activity?tab=requests")}>
                  Review
                </button>
              </Row>
            )}

            <Row title="Who can message you" desc="People who can start a new conversation with you.">
              <select
                className="settings-select-custom"
                value={settings.messagePrivacy}
                onChange={(e) => void updateSetting("messagePrivacy", e.target.value as ServerSettings["messagePrivacy"])}
              >
                <option value="everyone">Everyone</option>
                <option value="followers">People who follow me</option>
                <option value="nobody">No one</option>
              </select>
            </Row>

            <Row title="Who can comment" desc="Applies to all of your posts.">
              <select
                className="settings-select-custom"
                value={settings.commentPrivacy}
                onChange={(e) => void updateSetting("commentPrivacy", e.target.value as ServerSettings["commentPrivacy"])}
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="off">No one (comments off)</option>
              </select>
            </Row>

            <Row
              title="Show activity status"
              desc="Let people see when you were last active. If off, you can't see theirs either."
            >
              <Toggle
                label="Show activity status"
                checked={settings.showActivityStatus}
                onChange={(v) => void updateSetting("showActivityStatus", v)}
              />
            </Row>

            <Row title="Hide like counts" desc="Others won't see how many likes your posts get.">
              <Toggle
                label="Hide like counts"
                checked={settings.hideLikeCounts}
                onChange={(v) => void updateSetting("hideLikeCounts", v)}
              />
            </Row>
          </section>
        )}

        {/* ── Safety ── */}
        {settings && shouldShow("safety") && (
          <section className="settings-section">
            <SectionHead
              title="Blocked accounts"
              desc="Blocked people can't find your profile, see your posts or message you."
              badge={`${blockedUsers.length} blocked`}
            />
            <div className="settings-search-bar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={blockQuery}
                onChange={(e) => {
                  setBlockQuery(e.target.value);
                  if (!e.target.value.trim()) setBlockResults([]);
                }}
                placeholder="Search someone to block…"
              />
            </div>
            {blockQuery.trim() && blockResults.length > 0 && (
              <div className="settings-user-list">
                {blockResults.map((u) => (
                  <div key={u.id} className="settings-user-card">
                    <div className="settings-user-meta">
                      <UserAvatar src={u.profileImageUrl} name={u.username} size={40} />
                      <div className="settings-user-names">
                        <strong>{u.name || u.username}</strong>
                        <small>@{u.username}</small>
                      </div>
                    </div>
                    <button className="settings-btn-danger-outline" onClick={() => void handleBlock(u)}>
                      Block
                    </button>
                  </div>
                ))}
              </div>
            )}
            {blockedUsers.length === 0 ? (
              <div className="settings-empty-notice">
                <p>You haven&apos;t blocked anyone.</p>
              </div>
            ) : (
              <div className="settings-user-list">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="settings-user-card">
                    <div className="settings-user-meta">
                      <UserAvatar src={u.profileImageUrl} name={u.username} size={40} />
                      <div className="settings-user-names">
                        <strong>{u.name || u.username}</strong>
                        <small>@{u.username}</small>
                      </div>
                    </div>
                    <button className="settings-btn-outline" onClick={() => void handleUnblock(u)}>
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {settings && shouldShow("safety") && (
          <section className="settings-section">
            <SectionHead
              title="Muted accounts"
              desc="Posts from muted accounts don't appear in your feed. They aren't told."
              badge={`${mutedUsers.length} muted`}
            />
            {mutedUsers.length === 0 ? (
              <div className="settings-empty-notice">
                <p>Mute someone from the ⋯ menu on their post or profile.</p>
              </div>
            ) : (
              <div className="settings-user-list">
                {mutedUsers.map((u) => (
                  <div key={u.id} className="settings-user-card">
                    <div className="settings-user-meta">
                      <UserAvatar src={u.profileImageUrl} name={u.username} size={40} />
                      <div className="settings-user-names">
                        <strong>{u.name || u.username}</strong>
                        <small>@{u.username}</small>
                      </div>
                    </div>
                    <button className="settings-btn-outline" onClick={() => void handleUnmute(u)}>
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {settings && shouldShow("safety") && (
          <section className="settings-section">
            <SectionHead
              title="Hidden words"
              desc="Posts and comments containing these words are hidden from you on this device."
              badge={`${hiddenWords.length} words`}
            />
            <form
              className="sc-word-form"
              onSubmit={(e) => {
                e.preventDefault();
                addHiddenWord();
              }}
            >
              <input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Add a word or phrase…"
                maxLength={40}
                aria-label="Hidden word"
              />
              <button className="settings-btn-outline" type="submit" disabled={!newWord.trim()}>
                Add
              </button>
            </form>
            {hiddenWords.length > 0 && (
              <div className="sc-word-chips">
                {hiddenWords.map((w) => (
                  <span key={w} className="sc-word-chip">
                    {w}
                    <button
                      aria-label={`Remove ${w}`}
                      onClick={() => setHiddenWordsState(setHiddenWords(hiddenWords.filter((x) => x !== w)))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Notifications ── */}
        {settings && shouldShow("notifications") && (
          <section className="settings-section">
            <SectionHead
              title="Notifications"
              desc="Choose what you get notified about. Applies on every device."
              badge="Alerts"
            />
            {(
              [
                ["notifyLikes", "Likes & reposts", "When someone likes or reposts your post"],
                ["notifyComments", "Comments", "When someone comments on your post"],
                ["notifyMentions", "Mentions", "When someone @mentions you"],
                ["notifyFollows", "Followers", "New followers, follow requests and approvals"],
                ["notifyMessages", "Messages", "New direct messages"],
              ] as const
            ).map(([key, title, desc]) => (
              <Row key={key} title={title} desc={desc}>
                <Toggle label={title} checked={settings[key]} onChange={(v) => void updateSetting(key, v)} />
              </Row>
            ))}
          </section>
        )}

        {/* ── Appearance ── */}
        {settings && shouldShow("appearance") && (
          <section className="settings-section">
            <SectionHead title="Appearance" desc="Make Social Connect look the way you like (this device)." badge="Theme" />
            <Row title="Theme">
              <div className="sc-segmented sc-theme-picker" role="radiogroup" aria-label="Theme">
                {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={themeMode === m}
                    className={themeMode === m ? "active" : ""}
                    onClick={() => {
                      setThemeMode(m);
                      setThemeModeState(m);
                    }}
                  >
                    {m === "light" ? "☀️ Light" : m === "dark" ? "🌙 Dark" : "💻 System"}
                  </button>
                ))}
              </div>
            </Row>
            <Row title="Accent colour" desc="Used for buttons, badges and highlights.">
              <div className="sc-accent-picker" role="radiogroup" aria-label="Accent colour">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    role="radio"
                    aria-checked={accent === a.value}
                    title={a.name}
                    className={`sc-accent-swatch ${accent === a.value ? "active" : ""}`}
                    style={{ background: a.value }}
                    onClick={() => {
                      setAccent(a.value);
                      setAccentState(a.value);
                    }}
                  />
                ))}
              </div>
            </Row>
            <Row title="Reduce motion" desc="Turn off animations and transitions.">
              <Toggle
                label="Reduce motion"
                checked={reduceMotion}
                onChange={(v) => {
                  setReduceMotion(v);
                  setReduceMotionState(v);
                }}
              />
            </Row>
          </section>
        )}

        {/* ── Security ── */}
        {settings && shouldShow("security") && (
          <section className="settings-section">
            <SectionHead title="Security" desc="Protect your account." badge="Security" />

            <Row
              title={
                <>
                  Two-factor authentication{" "}
                  {twoFactor.enabled && <span className="sc-on-badge">On</span>}
                </>
              }
              desc={
                twoFactor.enabled
                  ? `Codes from your authenticator app are required to sign in. ${twoFactor.recoveryCodesRemaining} recovery codes left.`
                  : "Require a code from an authenticator app (Google Authenticator, Authy…) when you sign in."
              }
            >
              {twoFactor.enabled ? (
                <button
                  className="settings-btn-danger-outline"
                  onClick={() => {
                    setTfaError(null);
                    setTfaCode("");
                    setTfaPassword("");
                    setTfaStep("disable");
                  }}
                >
                  Turn off
                </button>
              ) : (
                <button className="settings-btn-outline" onClick={() => void startTwoFactor()} disabled={tfaBusy}>
                  {tfaBusy ? "…" : "Set up"}
                </button>
              )}
            </Row>

            <Row title="Log out of all other devices" desc="Ends every session except this one.">
              <button className="settings-btn-outline" onClick={() => setShowLogoutAll(true)}>
                Log out others
              </button>
            </Row>

            {passwordMsg && <div className={`settings-msg ${passwordMsg.type}`}>{passwordMsg.text}</div>}
            <div className="settings-form">
              <div className="settings-field">
                <label htmlFor="s-old-pw">Current password</label>
                <input
                  id="s-old-pw"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
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
                />
              </div>
              <button className="settings-save-btn" onClick={() => void changePassword()} disabled={savingPassword}>
                {savingPassword ? "Updating…" : "Change password"}
              </button>
            </div>
          </section>
        )}

        {/* ── Your data ── */}
        {settings && shouldShow("data") && (
          <section className="settings-section">
            <SectionHead title="Your data" desc="Download a copy of what you've shared." badge="Data" />
            <Row title="Download your data" desc="Profile, posts, comments, likes, saved posts and connections as JSON.">
              <button className="settings-btn-outline" onClick={() => void exportData()} disabled={exporting}>
                {exporting ? "Preparing…" : "Download"}
              </button>
            </Row>
          </section>
        )}

        {/* ── Session & danger zone ── */}
        {settings && (activeTab === "all" || activeTab === "account" || activeTab === "data") && (
          <section className="settings-section settings-section-danger">
            <SectionHead title="Session & account" desc="Log out, or permanently delete your account." />
            <div className="sc-inline-actions">
              <button className="settings-logout-btn" onClick={logout}>
                Log out
              </button>
              <button className="settings-btn-danger-outline" onClick={() => setShowDeleteModal(true)}>
                Delete account
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Change email */}
      {showEmailModal && (
        <div className="edit-overlay" onClick={() => !emailBusy && setShowEmailModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-header">
              <h2>Change email</h2>
              <button onClick={() => setShowEmailModal(false)} aria-label="Close">×</button>
            </div>
            <p className="sc-modal-text">Enter your new email and confirm with your password.</p>
            <input
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoFocus
            />
            <input
              type="password"
              placeholder="Current password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
            {emailError && <div className="sc-inline-error">{emailError}</div>}
            <div className="edit-actions">
              <button className="cancel-edit" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button
                className="save-edit"
                disabled={emailBusy || !newEmail.trim() || !emailPassword}
                onClick={() => void changeEmail()}
              >
                {emailBusy ? "Saving…" : "Update email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA setup / disable */}
      {tfaStep !== "idle" && (
        <div className="edit-overlay" onClick={() => !tfaBusy && tfaStep !== "codes" && setTfaStep("idle")}>
          <div className="edit-modal sc-tfa-modal" onClick={(e) => e.stopPropagation()}>
            {tfaStep === "scan" && (
              <>
                <div className="edit-header">
                  <h2>Set up 2FA</h2>
                  <button onClick={() => setTfaStep("idle")} aria-label="Close">×</button>
                </div>
                <ol className="sc-steps">
                  <li>Open an authenticator app (Google Authenticator, Authy, 1Password…).</li>
                  <li>Scan this QR code, or enter the key manually.</li>
                  <li>Type the 6-digit code it shows.</li>
                </ol>
                {tfaQr && <img className="sc-qr" src={tfaQr} alt="QR code for your authenticator app" />}
                <div className="sc-secret">
                  <code>{tfaSecret.replace(/(.{4})/g, "$1 ").trim()}</code>
                  <button
                    className="settings-link-btn"
                    onClick={() => {
                      void navigator.clipboard?.writeText(tfaSecret);
                      showGlobalToast("Key copied");
                    }}
                  >
                    Copy key
                  </button>
                </div>
                <input
                  className="sc-otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoFocus
                />
                {tfaError && <div className="sc-inline-error">{tfaError}</div>}
                <div className="edit-actions">
                  <button className="cancel-edit" onClick={() => setTfaStep("idle")}>Cancel</button>
                  <button
                    className="save-edit"
                    disabled={tfaBusy || tfaCode.length !== 6}
                    onClick={() => void confirmTwoFactor()}
                  >
                    {tfaBusy ? "Checking…" : "Turn on"}
                  </button>
                </div>
              </>
            )}

            {tfaStep === "codes" && (
              <>
                <div className="edit-header">
                  <h2>Save your recovery codes</h2>
                </div>
                <p className="sc-modal-text">
                  2FA is on. If you lose your phone, each of these codes lets you sign in once.
                  Store them somewhere safe — they won&apos;t be shown again.
                </p>
                <div className="sc-recovery-grid">
                  {recoveryCodes.map((c) => (
                    <code key={c}>{c}</code>
                  ))}
                </div>
                <div className="edit-actions">
                  <button
                    className="cancel-edit"
                    onClick={() => {
                      void navigator.clipboard?.writeText(recoveryCodes.join("\n"));
                      showGlobalToast("Codes copied");
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="cancel-edit"
                    onClick={() =>
                      downloadText("social-connect-recovery-codes.txt", recoveryCodes.join("\n"))
                    }
                  >
                    Download
                  </button>
                  <button className="save-edit" onClick={() => setTfaStep("idle")}>
                    I saved them
                  </button>
                </div>
              </>
            )}

            {tfaStep === "disable" && (
              <>
                <div className="edit-header">
                  <h2>Turn off 2FA</h2>
                  <button onClick={() => setTfaStep("idle")} aria-label="Close">×</button>
                </div>
                <p className="sc-modal-text">Confirm with your password and a code from your app (or a recovery code).</p>
                <input
                  type="password"
                  placeholder="Current password"
                  value={tfaPassword}
                  onChange={(e) => setTfaPassword(e.target.value)}
                  autoFocus
                />
                <input
                  placeholder="6-digit code or recovery code"
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.toUpperCase().slice(0, 11))}
                />
                {tfaError && <div className="sc-inline-error">{tfaError}</div>}
                <div className="edit-actions">
                  <button className="cancel-edit" onClick={() => setTfaStep("idle")}>Cancel</button>
                  <button
                    className="save-edit sc-danger-btn"
                    disabled={tfaBusy || !tfaPassword || tfaCode.trim().length < 6}
                    onClick={() => void disableTwoFactor()}
                  >
                    {tfaBusy ? "Turning off…" : "Turn off"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showLogoutAll}
        title="Log out of all other devices?"
        message="Every other browser and phone signed in to your account will be signed out. You'll stay signed in here."
        confirmText="Log out others"
        isDanger={false}
        isLoading={loggingOutAll}
        onConfirm={() => void logoutAllDevices()}
        onCancel={() => setShowLogoutAll(false)}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete your account?"
        message="This permanently deletes your account, posts, likes, comments, messages and follows. This can't be undone."
        confirmText="Delete account"
        isLoading={isDeletingAccount}
        onConfirm={() => void confirmDeleteAccount()}
        onCancel={() => setShowDeleteModal(false)}
      />

      <BottomNav />
    </>
  );
}

export default Settings;
