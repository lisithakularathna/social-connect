import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

interface User {
  id: number;
  username?: string;
  name?: string;
  profileImageUrl?: string;
}

function Following() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadFollowing = async () => {
    try {
      const me = await api.get("/users/me");
      const res = await api.get(`/follows/following/${me.data.id}`);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowing();
  }, []);

  const unfollow = async (userId: number) => {
    if (removingId !== null) return;

    try {
      setRemovingId(userId);
      await api.delete(`/follows/${userId}`);
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Navbar />

      <main className="following-page">
        <div className="following-container">
          <div className="following-header">
            <div>
              <h1>Following</h1>
              <p className="following-subtitle">
                {users.length} {users.length === 1 ? "person" : "people"} you follow
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading following...</div>
          ) : users.length === 0 ? (
            <div className="following-empty">
              <div className="following-empty-icon">♡</div>
              <h2>You are not following anyone yet</h2>
              <p>Search for people and follow them to see them here.</p>
              <button onClick={() => navigate("/search")}>Find people</button>
            </div>
          ) : (
            <div className="following-list">
              {users.map((user) => (
                <div className="following-user" key={user.id}>
                  <div
                    className="following-user-main"
                    onClick={() => navigate(`/user/${user.id}`)}
                  >
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        className="following-avatar"
                        alt={user.username || "user"}
                      />
                    ) : (
                      <div className="following-avatar-placeholder">
                        {(user.username || user.name || "U")[0].toUpperCase()}
                      </div>
                    )}

                    <div className="following-user-info">
                      <strong>{user.username || "user"}</strong>
                      {user.name && <span>{user.name}</span>}
                    </div>
                  </div>

                  <button
                    className="following-manage-btn"
                    onClick={() => unfollow(user.id)}
                    disabled={removingId === user.id}
                  >
                    {removingId === user.id ? "Removing..." : "Following"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

export default Following;
