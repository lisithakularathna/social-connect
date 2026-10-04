import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";
import "./Search.css";

interface User {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

interface SearchHistoryItem {
  id: string;
  type: "user" | "keyword";
  query?: string;
  user?: User;
  timestamp: number;
}

const STORAGE_KEY = "search_history";

function Search() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search History from localStorage
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveHistory = (items: SearchHistoryItem[]) => {
    setHistory(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const addToHistoryUser = (user: User) => {
    const newItem: SearchHistoryItem = {
      id: `user_${user.id}`,
      type: "user",
      user,
      timestamp: Date.now(),
    };
    const filtered = history.filter((item) => item.id !== newItem.id);
    const updated = [newItem, ...filtered].slice(0, 15);
    saveHistory(updated);
  };

  const addToHistoryKeyword = (keyword: string) => {
    const clean = keyword.trim();
    if (!clean) return;
    const newItem: SearchHistoryItem = {
      id: `kw_${clean.toLowerCase()}`,
      type: "keyword",
      query: clean,
      timestamp: Date.now(),
    };
    const filtered = history.filter((item) => item.id !== newItem.id);
    const updated = [newItem, ...filtered].slice(0, 15);
    saveHistory(updated);
  };

  const removeHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
  };

  const clearAllHistory = () => {
    saveHistory([]);
  };

  const searchUsers = async (value: string) => {
    setQuery(value);

    if (!value.trim()) {
      setUsers([]);
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setHasSearched(true);
      const response = await api.get(`/users/search?q=${encodeURIComponent(value)}`);
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Search failed:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    addToHistoryUser(user);
    navigate(`/user/${user.id}`);
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    if (item.type === "user" && item.user) {
      navigate(`/user/${item.user.id}`);
    } else if (item.query) {
      setQuery(item.query);
      void searchUsers(item.query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      addToHistoryKeyword(query);
    }
  };

  return (
    <>
      <Navbar />

      <main className="search-page">
        <div className="search-header">
          <h1>Search</h1>
          <p>Find friends, creators, and community members</p>
        </div>

        {/* Search Input Box */}
        <div className="search-box-wrap">
          <span className="search-box-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>

          <input
            className="search-box-input"
            value={query}
            onChange={(e) => searchUsers(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by username or name..."
            autoFocus
          />

          {query && (
            <button
              className="search-box-clear-btn"
              onClick={() => {
                setQuery("");
                setUsers([]);
                setHasSearched(false);
              }}
              title="Clear input"
            >
              ✕
            </button>
          )}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="search-loading-state">
            <p>Searching accounts…</p>
          </div>
        )}

        {/* LIVE SEARCH RESULTS (When query is present) */}
        {!loading && query.trim().length > 0 && (
          <section className="search-results-section">
            {users.length === 0 && hasSearched ? (
              <div className="search-empty-state">
                <h3>No accounts found</h3>
                <p>We couldn&apos;t find anyone matching &ldquo;{query}&rdquo;.</p>
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="search-result-card"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="search-result-left">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} className="search-result-avatar" alt={user.username} />
                    ) : (
                      <div className="search-result-avatar-fallback">
                        {(user.username || user.name || "U")[0].toUpperCase()}
                      </div>
                    )}

                    <div className="search-result-meta">
                      <strong>@{user.username || "user"}</strong>
                      {user.name && <span>{user.name}</span>}
                      {user.bio && <small>{user.bio}</small>}
                    </div>
                  </div>

                  <span className="search-result-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </div>
              ))
            )}
          </section>
        )}

        {/* RECENT SEARCH HISTORY (When query is empty) */}
        {!query && (
          <section className="search-history-section">
            <div className="search-history-header">
              <span className="search-history-title">Recent Searches</span>
              {history.length > 0 && (
                <button className="search-clear-all-btn" onClick={clearAllHistory}>
                  Clear all
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="search-history-empty">
                <p>No recent searches yet. Search for people to see them here!</p>
              </div>
            ) : (
              <div className="search-history-list">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="search-history-item"
                    onClick={() => handleSelectHistoryItem(item)}
                  >
                    <div className="search-history-item-left">
                      {item.type === "user" && item.user ? (
                        item.user.profileImageUrl ? (
                          <img src={item.user.profileImageUrl} className="search-history-avatar" alt={item.user.username} />
                        ) : (
                          <div className="search-history-avatar-fallback">
                            {(item.user.username || item.user.name || "U")[0].toUpperCase()}
                          </div>
                        )
                      ) : (
                        <div className="search-history-icon-badge">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                      )}

                      <div className="search-history-text">
                        {item.type === "user" && item.user ? (
                          <>
                            <strong>@{item.user.username || "user"}</strong>
                            {item.user.name && <small>{item.user.name}</small>}
                          </>
                        ) : (
                          <>
                            <strong>{item.query}</strong>
                            <small>Search term</small>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Individual remove button */}
                    <button
                      className="search-history-remove-btn"
                      onClick={(e) => removeHistoryItem(e, item.id)}
                      title="Remove from history"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default Search;
