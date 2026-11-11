import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import UserAvatar from "../components/UserAvatar";
import FollowButton from "../components/FollowButton";
import api, { getErrorMessage } from "../api/api";
import { getUserIdFromToken } from "../utils/session";

interface Person {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
  isPrivate?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
}

type Tab = "followers" | "following";

/**
 * Followers / Following lists for the signed-in user (/followers, /following)
 * or anyone else (/user/:userId/followers, /user/:userId/following).
 */
function Connections() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ userId?: string }>();
  const myId = getUserIdFromToken();
  const targetId = params.userId ? Number(params.userId) : myId;
  const isMe = targetId !== null && targetId === myId;
  const tab: Tab = location.pathname.endsWith("/followers") ? "followers" : "following";

  const [people, setPeople] = useState<Person[]>([]);
  const [owner, setOwner] = useState<{ username?: string } | null>(null);
  const [counts, setCounts] = useState({ followersCount: 0, followingCount: 0 });
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The list currently shown belongs to this key; any other key is loading.
  const requestKey = `${targetId}:${tab}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!targetId) return;
    let alive = true;

    Promise.all([
      api.get(`/follows/${tab}/${targetId}`),
      api.get(`/follows/stats/${targetId}`),
      isMe ? Promise.resolve(null) : api.get(`/users/${targetId}`),
    ])
      .then(([listRes, statsRes, userRes]) => {
        if (!alive) return;
        setPeople(Array.isArray(listRes.data) ? listRes.data : []);
        setCounts(statsRes.data ?? { followersCount: 0, followingCount: 0 });
        setOwner(userRes ? userRes.data : null);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setPeople([]);
        setError(
          err?.response?.status === 403
            ? "This account is private. Follow them to see their connections."
            : getErrorMessage(err, "Couldn't load this list")
        );
      })
      .finally(() => {
        if (!alive) return;
        setQuery("");
        setLoadedKey(`${targetId}:${tab}`);
      });

    return () => {
      alive = false;
    };
  }, [targetId, tab, isMe]);

  const basePath = isMe ? "" : `/user/${targetId}`;
  const goTab = (next: Tab) => navigate(`${basePath}/${next}`, { replace: true });

  const q = query.trim().toLowerCase();
  const visible = q
    ? people.filter(
        (p) => p.username?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q)
      )
    : people;

  const title = isMe ? "Your connections" : `@${owner?.username || "user"}`;

  return (
    <>
      <Navbar />

      <main className="sc-page sc-connections">
        <header className="sc-page-header">
          <button className="sc-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <p className="eyebrow">CONNECTIONS</p>
            <h1>{title}</h1>
          </div>
        </header>

        <div className="sc-segmented" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "followers"}
            className={tab === "followers" ? "active" : ""}
            onClick={() => goTab("followers")}
          >
            <strong>{counts.followersCount}</strong> Followers
          </button>
          <button
            role="tab"
            aria-selected={tab === "following"}
            className={tab === "following" ? "active" : ""}
            onClick={() => goTab("following")}
          >
            <strong>{counts.followingCount}</strong> Following
          </button>
        </div>

        {people.length > 5 && (
          <div className="sc-search-inline">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab}`}
              aria-label={`Search ${tab}`}
            />
          </div>
        )}

        {loading ? (
          <div className="sc-people-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="sc-person-row" key={i} aria-hidden="true">
                <div className="sc-skel sc-skel-circle" style={{ width: 48, height: 48 }} />
                <div style={{ flex: 1 }}>
                  <div className="sc-skel" style={{ width: "40%", height: 12, marginBottom: 7 }} />
                  <div className="sc-skel" style={{ width: "25%", height: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty">
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="sc-empty-icon" aria-hidden="true">{tab === "followers" ? "🌱" : "🔭"}</div>
            {q ? (
              <>
                <h2>No matches</h2>
                <p>Nobody here matches “{query}”.</p>
              </>
            ) : tab === "followers" ? (
              <>
                <h2>No followers yet</h2>
                <p>{isMe ? "Share posts to help people find you." : "Be the first to follow."}</p>
              </>
            ) : (
              <>
                <h2>Not following anyone</h2>
                {isMe && (
                  <>
                    <p>Find people to follow and their posts will show up in your feed.</p>
                    <button className="sc-btn sc-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/search")}>
                      Find people
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="sc-people-list">
            {visible.map((person) => (
              <div
                className="sc-person-row"
                key={person.id}
                onClick={() => navigate(person.id === myId ? "/profile" : `/user/${person.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/user/${person.id}`)}
              >
                <UserAvatar src={person.profileImageUrl} name={person.username || person.name} size={48} />
                <div className="sc-person-meta">
                  <strong>
                    {person.username || "user"}
                    {person.isPrivate && <span className="sc-lock" title="Private account">🔒</span>}
                  </strong>
                  {person.name && <span>{person.name}</span>}
                  {person.bio && <small>{person.bio}</small>}
                </div>
                {person.id !== myId && (
                  <div className="sc-person-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="sc-btn sc-btn-ghost sc-btn-sm"
                      onClick={() => navigate(`/messages/${person.id}`)}
                    >
                      Message
                    </button>
                    {isMe && tab === "followers" && (
                      <button
                        className="sc-btn sc-btn-ghost sc-btn-sm"
                        onClick={async () => {
                          try {
                            await api.delete(`/follows/followers/${person.id}`);
                            setPeople((list) => list.filter((p) => p.id !== person.id));
                            setCounts((c) => ({ ...c, followersCount: Math.max(0, c.followersCount - 1) }));
                          } catch (err) {
                            setError(getErrorMessage(err, "Couldn't remove follower"));
                          }
                        }}
                        title="Remove this follower"
                      >
                        Remove
                      </button>
                    )}
                    <FollowButton
                      userId={person.id}
                      initialFollowing={Boolean(person.isFollowing)}
                      initialRequested={Boolean(person.isRequested)}
                      onChange={(following) => {
                        if (isMe && tab === "following") {
                          setCounts((c) => ({
                            ...c,
                            followingCount: Math.max(0, c.followingCount + (following ? 1 : -1)),
                          }));
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default Connections;
