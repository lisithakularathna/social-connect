import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";
import { getUserIdFromToken } from "../utils/session";

/** /u/:username — resolves an @mention to the right profile. */
function UsernameRedirect() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get(`/users/by-username/${encodeURIComponent(username || "")}`)
      .then((res) => {
        if (!alive) return;
        const id = Number(res.data?.id);
        setTarget(id === getUserIdFromToken() ? "/profile" : `/user/${id}`);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [username]);

  if (target) return <Navigate to={target} replace />;

  return (
    <>
      <Navbar />
      <main className="sc-page">
        <div className="empty">
          {missing ? (
            <>
              <div className="sc-empty-icon" aria-hidden="true">🔍</div>
              <h2>@{username} isn&apos;t available</h2>
              <p>The account may have been renamed or deleted.</p>
              <button className="sc-btn sc-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/search")}>
                Search people
              </button>
            </>
          ) : (
            <p>
              <span className="sc-spinner" /> Finding @{username}…
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

export default UsernameRedirect;
