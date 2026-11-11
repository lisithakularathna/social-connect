import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import StoriesBar from "../components/StoriesBar";
import SuggestedUsers from "../components/SuggestedUsers";
import api, { getErrorMessage } from "../api/api";
import { getCurrentUser } from "../utils/session";
import { containsHiddenWord, getHiddenWords, PREFS_CHANGED_EVENT } from "../utils/prefs";

interface Post {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  fontSize?: number;
  authorId: number;
  author?: {
    id?: number;
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
  createdAt?: string;
  likesCount?: number;
  isLiked?: boolean;
  commentsCount?: number;
  isRepost?: boolean;
  repostedBy?: {
    id?: number;
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
  originalPostId?: number;
}

interface CurrentUser {
  id: number;
  username?: string;
  profileImageUrl?: string;
}

type FeedScope = "all" | "following";

const PAGE_SIZE = 10;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function FeedSkeleton() {
  return (
    <div className="feed">
      {[0, 1].map((i) => (
        <div className="sc-post-skeleton" key={i} aria-hidden="true">
          <div className="sc-post-skeleton-head">
            <div className="sc-skel sc-skel-circle" style={{ width: 42, height: 42 }} />
            <div style={{ flex: 1 }}>
              <div className="sc-skel" style={{ width: "38%", height: 12, marginBottom: 7 }} />
              <div className="sc-skel" style={{ width: "22%", height: 10 }} />
            </div>
          </div>
          <div className="sc-skel" style={{ width: "100%", height: 260, borderRadius: 14 }} />
          <div className="sc-skel" style={{ width: "60%", height: 12, marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<FeedScope>(
    () => (localStorage.getItem("feedScope") as FeedScope) || "all"
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenWords, setHiddenWords] = useState<string[]>(() => getHiddenWords());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      const seq = ++requestSeq.current;
      // Replacing callers set `loading` themselves (initial state / handlers).
      if (!replace) setLoadingMore(true);
      try {
        const { data } = await api.get("/posts", {
          params: { page: pageToLoad, limit: PAGE_SIZE, scope },
        });
        if (seq !== requestSeq.current) return; // a newer request superseded this one
        setError(null);
        const list: Post[] = Array.isArray(data) ? data : data.posts || [];
        setPosts((prev) => {
          if (replace) return list;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...list.filter((p) => !seen.has(p.id))];
        });
        setPage(pageToLoad);
        setHasMore(Array.isArray(data) ? false : Boolean(data.pagination?.hasMore));
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(getErrorMessage(err, "Failed to load posts"));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [scope]
  );

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  useEffect(() => {
    let alive = true;
    void getCurrentUser().then((me) => {
      if (alive && me) {
        setAccount({
          id: me.id,
          username: me.username || me.name,
          profileImageUrl: me.profileImageUrl,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // State is only set after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useEffect(() => {
    // Muting/blocking from a post menu refreshes the feed; hidden words
    // are filtered locally.
    const onPrefs = () => setHiddenWords(getHiddenWords());
    window.addEventListener(PREFS_CHANGED_EVENT, onPrefs);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, onPrefs);
  }, []);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          void fetchPage(page + 1, false);
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  const switchScope = (next: FeedScope) => {
    if (next === scope) return;
    localStorage.setItem("feedScope", next);
    setPosts([]);
    setHasMore(true);
    setLoading(true);
    setError(null);
    setScope(next);
  };

  // Blocked / muted / private accounts are filtered by the server.
  const visiblePosts = posts.filter(
    (p) => !containsHiddenWord(`${p.title} ${p.content ?? ""}`, hiddenWords)
  );

  return (
    <>
      <Navbar />

      <div className="home-shell">
        <main className="home-main">
          <header className="feed-header">
            <div>
              <p className="eyebrow">YOUR COMMUNITY</p>
              <h1>
                {greeting()}
                {account?.username ? `, ${account.username}` : ""}
              </h1>
              <p>See what&apos;s happening in your circle today.</p>
            </div>
            <button className="feed-create-button" onClick={() => navigate("/create")}>
              Create post <span aria-hidden="true">+</span>
            </button>
          </header>

          <StoriesBar posts={posts} currentUser={account} />

          <div className="sc-feed-tabs" role="tablist" aria-label="Feed">
            <button
              role="tab"
              aria-selected={scope === "all"}
              className={scope === "all" ? "active" : ""}
              onClick={() => switchScope("all")}
            >
              For you
            </button>
            <button
              role="tab"
              aria-selected={scope === "following"}
              className={scope === "following" ? "active" : ""}
              onClick={() => switchScope("following")}
            >
              Following
            </button>
          </div>

          {loading && posts.length === 0 ? (
            <FeedSkeleton />
          ) : error && posts.length === 0 ? (
            <div className="empty">
              <div className="sc-empty-icon" aria-hidden="true">⚠️</div>
              <h2>Couldn&apos;t load your feed</h2>
              <p>{error}</p>
              <button
                className="sc-btn sc-btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  void reload();
                }}
              >
                Try again
              </button>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="empty">
              <div className="sc-empty-icon" aria-hidden="true">{scope === "following" ? "👋" : "✨"}</div>
              {scope === "following" ? (
                <>
                  <h2>Your following feed is quiet</h2>
                  <p>Follow people to see their posts here.</p>
                  <button className="sc-btn sc-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/search")}>
                    Find people
                  </button>
                </>
              ) : (
                <>
                  <h2>No posts yet</h2>
                  <p>Be the first person to share something.</p>
                  <button className="sc-btn sc-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/create")}>
                    Create a post
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="feed">
              {visiblePosts.map((post, index) => (
                <Fragment key={post.id}>
                  <PostCard post={post} onDelete={() => void reload()} />
                  {index === 2 && (
                    <div className="home-inline-suggest">
                      <SuggestedUsers limit={4} variant="compact" />
                    </div>
                  )}
                </Fragment>
              ))}

              <div ref={sentinelRef} className="sc-feed-sentinel" aria-hidden="true" />

              {loadingMore && (
                <div className="sc-feed-more">
                  <span className="sc-spinner" /> Loading more…
                </div>
              )}
              {error && posts.length > 0 && (
                <div className="sc-feed-more">
                  {error}{" "}
                  <button className="sc-link-btn" onClick={() => void fetchPage(page + 1, false)}>
                    Retry
                  </button>
                </div>
              )}
              {!hasMore && !loadingMore && (
                <div className="sc-feed-end">You&apos;re all caught up ✓</div>
              )}
            </div>
          )}
        </main>

        <aside className="home-aside" aria-label="Suggestions">
          <SuggestedUsers limit={6} />
          <p className="home-aside-footer">© {new Date().getFullYear()} Social Connect</p>
        </aside>
      </div>

      <BottomNav />
    </>
  );
}

export default Home;
