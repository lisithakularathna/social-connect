import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

interface User {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

function Search() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (value: string) => {
    setQuery(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);

      const response = await api.get(
        `/users/search?q=${encodeURIComponent(value)}`
      );

      setUsers(response.data);
    } catch (error) {
      console.error(error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="search-page">
        <div className="search-container">
          <h1>Search</h1>

          <div className="search-box">
            <span>⌕</span>

            <input
              value={query}
              onChange={(e) =>
                searchUsers(e.target.value)
              }
              placeholder="Search users..."
              autoFocus
            />

            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setUsers([]);
                }}
              >
                ×
              </button>
            )}
          </div>

          {loading && (
            <div className="search-loading">
              Searching...
            </div>
          )}

          {!loading &&
            query &&
            users.length === 0 && (
              <div className="search-empty">
                <h2>No users found</h2>
                <p>
                  Try another username or name.
                </p>
              </div>
            )}

          <div className="search-results">
            {users.map((user) => (
              <div
                className="search-user"
                key={user.id}
                onClick={() =>
                  navigate(`/user/${user.id}`)
                }
              >
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    className="search-avatar"
                    alt={user.username}
                  />
                ) : (
                  <div className="search-avatar-placeholder">
                    {(user.username ||
                      user.name ||
                      "U")[0].toUpperCase()}
                  </div>
                )}

                <div className="search-user-info">
                  <strong>
                    {user.username || "user"}
                  </strong>

                  {user.name && (
                    <span>{user.name}</span>
                  )}

                  {user.bio && (
                    <small>{user.bio}</small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

export default Search;
