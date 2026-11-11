import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import UserAvatar from "./UserAvatar";
import FollowButton from "./FollowButton";

interface Suggestion {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
  isPrivate?: boolean;
  followersCount: number;
  mutualCount: number;
  followsYou: boolean;
}

interface Props {
  title?: string;
  limit?: number;
  variant?: "list" | "compact";
  showSeeAll?: boolean;
}

function reasonFor(s: Suggestion) {
  if (s.followsYou) return "Follows you";
  if (s.mutualCount > 0) {
    return `${s.mutualCount} mutual connection${s.mutualCount === 1 ? "" : "s"}`;
  }
  if (s.followersCount > 0) {
    return `${s.followersCount} follower${s.followersCount === 1 ? "" : "s"}`;
  }
  return "New to Social Connect";
}

function SuggestedUsers({
  title = "Suggested for you",
  limit = 6,
  variant = "list",
  showSeeAll = true,
}: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get(`/users/suggestions?limit=${limit}`)
      .then((res) => {
        if (!alive) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [limit]);

  if (items === null) {
    return (
      <section className={`sc-suggest sc-suggest-${variant}`}>
        <h3 className="sc-suggest-title">{title}</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="sc-suggest-row" key={i}>
            <div className="sc-skel sc-skel-circle" style={{ width: 40, height: 40 }} />
            <div style={{ flex: 1 }}>
              <div className="sc-skel" style={{ width: "55%", height: 12, marginBottom: 6 }} />
              <div className="sc-skel" style={{ width: "35%", height: 10 }} />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className={`sc-suggest sc-suggest-${variant}`}>
      <div className="sc-suggest-head">
        <h3 className="sc-suggest-title">{title}</h3>
        {showSeeAll && (
          <button type="button" className="sc-link-btn" onClick={() => navigate("/search")}>
            See all
          </button>
        )}
      </div>
      {items.map((u) => (
        <div
          className="sc-suggest-row"
          key={u.id}
          onClick={() => navigate(`/user/${u.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/user/${u.id}`)}
        >
          <UserAvatar src={u.profileImageUrl} name={u.username || u.name} size={40} />
          <div className="sc-suggest-meta">
            <strong>
              {u.username || "user"}
              {u.isPrivate && <span className="sc-lock" title="Private account">🔒</span>}
            </strong>
            <span>{reasonFor(u)}</span>
          </div>
          <FollowButton userId={u.id} initialFollowing={false} followsYou={u.followsYou} />
        </div>
      ))}
    </section>
  );
}

export default SuggestedUsers;
