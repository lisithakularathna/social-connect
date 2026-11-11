import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearSession, getCurrentUser, subscribeCurrentUser } from "../utils/session";
import { formatBadge, useUnreadCounts } from "../utils/unread";
import { isDarkActive, PREFS_CHANGED_EVENT, setThemeMode } from "../utils/prefs";
import "./Navbar.css";

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
  const [isDarkMode, setIsDarkMode] = useState(() => isDarkActive());
  const [account, setAccount] = useState<Account | null>(null);
  const [showMore, setShowMore] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const unread = useUnreadCounts();

  // Theme is applied by utils/prefs; just mirror it for the menu label.
  useEffect(() => {
    const sync = () => setIsDarkMode(isDarkActive());
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    let alive = true;
    void getCurrentUser().then((user) => alive && setAccount(user));
    const unsubscribe = subscribeCurrentUser((user) => setAccount(user));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Keep in sync when another tab changes the theme.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "themeMode" || e.key === "darkMode") setIsDarkMode(isDarkActive());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    if (showMore) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showMore]);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="left-sidebar" aria-label="Main Navigation">
      {/* Brand Logo with animated emblem */}
      <div
        className="sidebar-logo-wrapper"
        onClick={() => navigate("/")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && navigate("/")}
        aria-label="Social Connect Home"
      >
        <div className="sidebar-logo-icon">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>
        <span className="sidebar-logo-text">Social Connect</span>
      </div>

      {/* Navigation items with modern vector SVG icons and active filled states */}
      <nav className="sidebar-nav">
        {/* Home */}
        <NavLink
          to="/"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <div className="sidebar-icon-wrap">
                {isActive ? (
                  <svg className="sidebar-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                  </svg>
                ) : (
                  <svg
                    className="sidebar-svg-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
              </div>
              <span className="sidebar-link-label">Home</span>
            </>
          )}
        </NavLink>

        {/* Search */}
        <NavLink
          to="/search"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <div className="sidebar-icon-wrap">
                <svg
                  className="sidebar-svg-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? "2.6" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <span className="sidebar-link-label">Search</span>
            </>
          )}
        </NavLink>

        {/* Messages */}
        <NavLink
          to="/messages"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <div className="sidebar-icon-wrap">
                {isActive ? (
                  <svg className="sidebar-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                ) : (
                  <svg
                    className="sidebar-svg-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                )}
                {unread.messages > 0 && (
                  <span className="nav-count-badge" aria-label={`${unread.messages} unread messages`}>
                    {formatBadge(unread.messages)}
                  </span>
                )}
              </div>
              <span className="sidebar-link-label">Messages</span>
            </>
          )}
        </NavLink>

        {/* Notifications / Activity */}
        <NavLink
          to="/activity"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <div className="sidebar-icon-wrap">
                {isActive ? (
                  <svg className="sidebar-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg
                    className="sidebar-svg-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                )}
                {unread.activity > 0 && (
                  <span className="nav-count-badge" aria-label={`${unread.activity} unread notifications`}>
                    {formatBadge(unread.activity)}
                  </span>
                )}
              </div>
              <span className="sidebar-link-label">Notifications</span>
            </>
          )}
        </NavLink>

        {/* Create */}
        <NavLink
          to="/create"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <div className="sidebar-icon-wrap">
                <svg
                  className="sidebar-svg-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? "2.6" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="5" />
                  <line x1="12" x2="12" y1="8" y2="16" />
                  <line x1="8" x2="16" y1="12" y2="12" />
                </svg>
              </div>
              <span className="sidebar-link-label">Create</span>
            </>
          )}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          {() => (
            <>
              <div className="sidebar-icon-wrap">
                <div className="sidebar-avatar-ring">
                  {account?.profileImageUrl ? (
                    <img
                      className="sidebar-avatar-img"
                      src={account.profileImageUrl}
                      alt="Your profile"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="sidebar-avatar-fallback">
                      {account?.username?.charAt(0).toUpperCase() ||
                        account?.name?.charAt(0).toUpperCase() ||
                        "U"}
                    </div>
                  )}
                </div>
              </div>
              <span className="sidebar-link-label">Profile</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* Bottom Section: More & Options */}
      <div className="sidebar-bottom">
        <div className="more-menu-container" ref={moreMenuRef}>
          {showMore && (
            <div className="more-dropdown" role="menu">
              <button
                onClick={() => {
                  navigate("/settings");
                  setShowMore(false);
                }}
                role="menuitem"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  setThemeMode(isDarkMode ? "light" : "dark");
                  setShowMore(false);
                }}
                role="menuitem"
              >
                {isDarkMode ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                )}
                <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>

              <button onClick={logout} className="logout-text" role="menuitem">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowMore(!showMore)}
            className="sidebar-link more-btn"
            aria-haspopup="true"
            aria-expanded={showMore}
          >
            <div className="sidebar-icon-wrap">
              <svg
                className="sidebar-svg-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </div>
            <span className="sidebar-link-label">More</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Navbar;
