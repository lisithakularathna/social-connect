import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import SuggestedUsers from "../components/SuggestedUsers";
import PostCard from "../components/PostCard";
import api from "../api/api";
import "./Search.css";

interface User {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

type SearchTab = "people" | "posts";
type PostResult = Parameters<typeof PostCard>[0]["post"];

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<SearchTab>(
    () => (searchParams.get("tab") === "posts" ? "posts" : "people")
  );
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [users, setUsers] = useState<User[]>([]);
  const [postResults, setPostResults] = useState<PostResult[]>([]);
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

  const requestSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const runSearch = async (value: string, which: SearchTab = tab) => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      if (which === "posts") {
        const response = await api.get(`/posts/search?q=${encodeURIComponent(value)}`);
        if (seq !== requestSeq.current) return;
        setPostResults(Array.isArray(response.data) ? response.data : []);
      } else {
        const response = await api.get(`/users/search?q=${encodeURIComponent(value)}`);
        // Ignore responses for queries the user has already typed past.
        if (seq !== requestSeq.current) return;
        setUsers(Array.isArray(response.data) ? response.data : []);
      }
      setHasSearched(true);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      console.error("Search failed:", error);
      setUsers([]);
      setPostResults([]);
      setHasSearched(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Deep links like /search?tab=posts&q=%23travel (from #hashtags).
  useEffect(() => {
    const q = searchParams.get("q");
    const t: SearchTab = searchParams.get("tab") === "posts" ? "posts" : "people";
    if (q && q.trim()) {
      // Syncing local state from the URL (e.g. a #hashtag link) is intended.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(t);
      setQuery(q);
      void runSearch(q.trim(), t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const switchTab = (next: SearchTab) => {
    if (next === tab) return;
    setTab(next);
    setHasSearched(false);
    const params: Record<string, string> = next === "posts" ? { tab: "posts" } : {};
    if (query.trim()) params.q = query.trim();
    setSearchParams(params, { replace: true });
    if (query.trim()) void runSearch(query.trim(), next);
  };

  const searchUsers = (value: string, immediate = false) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      requestSeq.current++;
      setUsers([]);
      setPostResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    if (immediate) {
      void runSearch(value.trim());
    } else {
      setLoading(true);
      debounceRef.current = setTimeout(() => void runSearch(value.trim()), 250);
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
      searchUsers(item.query, true);
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
            placeholder={tab === "posts" ? "Search posts, #hashtags…" : "Search by username or name..."}
            autoFocus
          />

          {query && (
            <button
              className="search-box-clear-btn"
              onClick={() => searchUsers("")}
              title="Clear input"
            >
              ✕
            </button>
          )}
        </div>

        <div className="sc-segmented sc-search-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "people"}
            className={tab === "people" ? "active" : ""}
            onClick={() => switchTab("people")}
          >
            People
          </button>
          <button
            role="tab"
            aria-selected={tab === "posts"}
            className={tab === "posts" ? "active" : ""}
            onClick={() => switchTab("posts")}
          >
            Posts
          </button>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="search-loading-state">
            <p>Searching accounts…</p>
          </div>
        )}

        {/* POST RESULTS */}
        {!loading && tab === "posts" && query.trim().length > 0 && (
          <section className="search-results-section">
            {postResults.length === 0 && hasSearched ? (
              <div className="search-empty-state">
                <h3>No posts found</h3>
                <p>Nothing matches &ldquo;{query}&rdquo; yet.</p>
              </div>
            ) : (
              <div className="feed">
                {postResults.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* LIVE SEARCH RESULTS (When query is present) */}
        {!loading && tab === "people" && query.trim().length > 0 && (
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

        {!query && (
          <div className="search-suggestions">
            <SuggestedUsers title="People you may know" limit={8} showSeeAll={false} />
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default Search;
