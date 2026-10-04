import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import api from "../api/api";
import "./UserProfile.css";

interface User {
  id: number;
  email: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
}

interface Post {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  fontSize?: number;
  authorId: number;
  createdAt?: string;
  author?: {
    id?: number;
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
  isRepost?: boolean;
  repostedBy?: {
    id?: number;
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
  originalPostId?: number;
}

interface FollowStats {
  followersCount: number;
  followingCount: number;
}

function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "reposts">("posts");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [followStats, setFollowStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleShareProfile = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast("Profile link copied to clipboard! 📋");
    }
  };

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      const [userRes, postsRes, statsRes, meRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/posts/user/${userId}`),
        api.get(`/follows/stats/${userId}`),
        api.get("/users/me"),
      ]);

      setUser(userRes.data);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setFollowStats(statsRes.data || {
        followersCount: 0,
        followingCount: 0,
      });

      try {
        const followCheckRes = await api.get(`/follows/check/${userId}`);
        setIsFollowing(Boolean(followCheckRes.data?.isFollowing));
      } catch {
        setIsFollowing(false);
      }

      if (meRes.data?.id) {
        setCurrentUserId(Number(meRes.data.id));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!userId || followLoading) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        setIsFollowing(false);
        setFollowStats(prev => ({
          ...prev,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
        await api.delete(`/follows/${userId}`);
      } else {
        setIsFollowing(true);
        setFollowStats(prev => ({
          ...prev,
          followersCount: prev.followersCount + 1,
        }));
        await api.post(`/follows/${userId}`);
      }
    } catch (error) {
      console.error(error);
      loadUserProfile();
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="user-profile-page">
          <div className="empty">
            <p>Loading profile...</p>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="user-profile-page">
          <div className="empty">
            <h2>User not found</h2>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  // Separate original own posts from reposts
  const ownPosts = posts.filter(
    (p: any) =>
      !p.isRepost &&
      !p.repostedBy &&
      !p.title?.startsWith("Reposted:") &&
      !p.content?.includes("↻ Reposted") &&
      !p.content?.includes("[REPOST_META:")
  );
  const reposts = posts.filter(
    (p: any) =>
      p.isRepost ||
      p.repostedBy ||
      p.title?.startsWith("Reposted:") ||
      p.content?.includes("↻ Reposted") ||
      p.content?.includes("[REPOST_META:")
  );

  const displayedPosts = activeTab === "posts" ? ownPosts : reposts;

  return (
    <>
      <Navbar />

      <main className="user-profile-page">
        {/* ── Hero Profile Card ── */}
        <section className="user-profile-card">
          <div className="user-avatar-wrapper">
            <div className="user-avatar-ring">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  className="user-avatar-img"
                  alt={user.username || "Profile"}
                />
              ) : (
                <div className="user-avatar-fallback">
                  {(user.username || user.name || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="user-info-col">
            <div className="user-title-row">
              <div className="user-identity">
                <h1 className="user-main-username">
                  {user.username || "user"}
                </h1>
                {user.name && <p className="user-full-name">{user.name}</p>}
              </div>

              {/* Action Buttons: Follow, Message, Share */}
              <div className="user-actions-row">
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`user-btn-follow ${isFollowing ? "following" : ""}`}
                >
                  {isFollowing ? (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                      <span>Follow</span>
                    </>
                  )}
                </button>

                {currentUserId !== null && currentUserId !== Number(user.id) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${userId}`)}
                    className="user-btn-message"
                    title={`Send message to @${user.username || "user"}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="17"
                      height="17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <span>Message</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="user-btn-icon"
                  title="Share profile / Copy link"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="user-stats-bar">
              <div className="user-stat-card">
                <span className="user-stat-number">{ownPosts.length}</span>
                <span className="user-stat-label">Posts</span>
              </div>
              <div className="user-stat-card">
                <span className="user-stat-number">{followStats.followersCount}</span>
                <span className="user-stat-label">Followers</span>
              </div>
              <div className="user-stat-card">
                <span className="user-stat-number">{followStats.followingCount}</span>
                <span className="user-stat-label">Following</span>
              </div>
            </div>

            {/* Bio */}
            {user.bio && <p className="user-bio-text">{user.bio}</p>}
          </div>
        </section>

        {/* ── Tabs Navigation: POSTS / REPOSTS ── */}
        <div className="user-tabs-nav">
          <button
            type="button"
            className={`user-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <span className="user-tab-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <span>POSTS</span>
            <span className="user-tab-badge">{ownPosts.length}</span>
          </button>

          <button
            type="button"
            className={`user-tab-btn ${activeTab === "reposts" ? "active" : ""}`}
            onClick={() => setActiveTab("reposts")}
          >
            <span className="user-tab-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
            <span>REPOSTS</span>
            <span className="user-tab-badge">{reposts.length}</span>
          </button>
        </div>

        {/* ── User Posts Grid ── */}
        <section className="user-posts-section">
          {displayedPosts.length === 0 ? (
            <div className="user-posts-empty">
              <div className="user-posts-empty-icon">{activeTab === "posts" ? "📷" : "🔁"}</div>
              <h3>{activeTab === "posts" ? "No posts yet" : "No reposts yet"}</h3>
              <p>
                {activeTab === "posts"
                  ? `When @${user.username || "this user"} shares photos or posts, they'll appear here.`
                  : `When @${user.username || "this user"} reposts content, it will appear here.`}
              </p>
            </div>
          ) : (
            <div className="user-posts-grid">
              {displayedPosts.map((post) => (
                <div
                  className="user-grid-item"
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  title={post.title}
                >
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} className="user-grid-img" />
                  ) : (
                    <div
                      className="user-grid-color-post"
                      style={{
                        backgroundColor: post.backgroundColor || "#6366f1",
                        color: "#ffffff",
                        fontSize: `${Math.min(Math.max((post.fontSize || 20) * 0.75, 13), 20)}px`,
                      }}
                    >
                      {post.title}
                    </div>
                  )}
                  {post.isRepost && (
                    <div className="user-grid-repost-badge" title="Reposted">
                      🔁 Repost
                    </div>
                  )}
                  <div className="user-grid-hover-overlay">
                    <span className="user-grid-overlay-caption">{post.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Post Detail Modal */}
        {selectedPost && (
          <div
            className="post-modal-overlay"
            onClick={() => setSelectedPost(null)}
          >
            <div
              className="post-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="post-modal-close"
                onClick={() => setSelectedPost(null)}
                title="Close"
              >
                ×
              </button>
              <PostCard
                post={selectedPost}
                onDelete={() => {
                  loadUserProfile();
                  setSelectedPost(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toastMsg && (
          <div className="user-profile-toast">
            {toastMsg}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default UserProfile;
