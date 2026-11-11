import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import api, { getErrorMessage } from "../api/api";

type PostData = Parameters<typeof PostCard>[0]["post"];

/** Shareable single-post page: /post/:postId */
function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which postId the current post/error belong to; anything else is loading.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== postId;

  useEffect(() => {
    let alive = true;
    api
      .get(`/posts/${postId}`)
      .then((res) => {
        if (!alive) return;
        setPost(res.data);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setPost(null);
        setError(
          err?.response?.status === 404
            ? "This post doesn't exist or was deleted."
            : getErrorMessage(err, "Couldn't load this post")
        );
      })
      .finally(() => alive && setLoadedId(postId ?? null));
    return () => {
      alive = false;
    };
  }, [postId]);

  return (
    <>
      <Navbar />
      <main className="sc-page sc-post-detail">
        <header className="sc-page-header">
          <button className="sc-back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} aria-label="Go back">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <p className="eyebrow">POST</p>
            <h1>{post?.author?.username ? `@${post.author.username}` : "Post"}</h1>
          </div>
        </header>

        {loading ? (
          <div className="sc-post-skeleton" aria-hidden="true">
            <div className="sc-post-skeleton-head">
              <div className="sc-skel sc-skel-circle" style={{ width: 42, height: 42 }} />
              <div style={{ flex: 1 }}>
                <div className="sc-skel" style={{ width: "38%", height: 12, marginBottom: 7 }} />
                <div className="sc-skel" style={{ width: "22%", height: 10 }} />
              </div>
            </div>
            <div className="sc-skel" style={{ width: "100%", height: 320, borderRadius: 14 }} />
          </div>
        ) : error || !post ? (
          <div className="empty">
            <div className="sc-empty-icon" aria-hidden="true">🔍</div>
            <h2>Post unavailable</h2>
            <p>{error}</p>
            <button className="sc-btn sc-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/")}>
              Back to feed
            </button>
          </div>
        ) : (
          <PostCard
            key={`${post.id}-${post.title}-${post.content ?? ""}`}
            post={post}
            onDelete={() => {
              // PostCard calls this after edits/reposts too: re-fetch, and only
              // leave the page if the post is really gone.
              api
                .get(`/posts/${post.id}`)
                .then((res) => setPost(res.data))
                .catch(() => navigate("/", { replace: true }));
            }}
          />
        )}
      </main>
      <BottomNav />
    </>
  );
}

export default PostDetail;
