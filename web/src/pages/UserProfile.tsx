import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import api from "../api/api";
import { getUserIdFromToken } from "../utils/session";
import { blockUser, muteUser, unblockUser, unmuteUser } from "../utils/prefs";
import ConfirmModal from "../components/ConfirmModal";
import { getErrorMessage } from "../api/api";
import { showGlobalToast } from "../utils/toast";
import { readableTextColor } from "../utils/color";
import "./UserProfile.css";

interface User {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
  createdAt?: string;
  postsCount?: number;
  isPrivate?: boolean;
  isFollowing?: boolean;
  isRequested?: boolean;
  followsYou?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
  canViewContent?: boolean;
  canMessage?: boolean;
  isOnline?: boolean;
  lastActiveAt?: string | null;
}

function presenceLabel(user: User) {
  if (user.isOnline) return "Active now";
  if (!user.lastActiveAt) return null;
  const mins = Math.floor((Date.now() - new Date(user.lastActiveAt).getTime()) / 60000);
  if (mins < 60) return `Active ${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days <= 7 ? `Active ${days}d ago` : null;
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
  const [isRequested, setIsRequested] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const navigate = useNavigate();
  const myId = getUserIdFromToken();

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

    setLoading(true);
    setUser(null);
    try {
      const [userRes, postsRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/posts/user/${userId}`),
      ]);

      const profile: User = userRes.data;
      setUser(profile);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setFollowStats({
        followersCount: userRes.data?.followersCount ?? 0,
        followingCount: userRes.data?.followingCount ?? 0,
      });
      setIsFollowing(Boolean(profile.isFollowing));
      setIsRequested(Boolean(profile.isRequested));
      setMuted(Boolean(profile.isMuted));
      setBlocked(Boolean(profile.isBlocked));
      setCurrentUserId(myId);
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
      if (isFollowing || isRequested) {
        const wasFollowing = isFollowing;
        setIsFollowing(false);
        setIsRequested(false);
        if (wasFollowing) {
          setFollowStats((prev) => ({
            ...prev,
            followersCount: Math.max(0, prev.followersCount - 1),
          }));
        }
        await api.delete(`/follows/${userId}`);
        // Unfollowing a private account hides its posts again.
        if (wasFollowing && user?.isPrivate) void loadUserProfile();
      } else {
        const { data } = await api.post(`/follows/${userId}`);
        if (data?.requested) {
          setIsRequested(true);
          showGlobalToast("Follow request sent");
        } else {
          setIsFollowing(true);
          setFollowStats((prev) => ({
            ...prev,
            followersCount: prev.followersCount + 1,
          }));
        }
      }
    } catch (error) {
      showGlobalToast(getErrorMessage(error, "Couldn't update follow"));
      void loadUserProfile();
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleMute = async () => {
    if (!user) return;
    setShowMoreMenu(false);
    try {
      if (muted) {
        await unmuteUser(user.id);
        setMuted(false);
        showGlobalToast(`Unmuted @${user.username || "user"}`);
      } else {
        await muteUser(user.id);
        setMuted(true);
        showGlobalToast(`Muted @${user.username || "user"} — their posts are hidden from your feed`);
      }
    } catch (error) {
      showGlobalToast(getErrorMessage(error, "Couldn't update mute"));
    }
  };

  const toggleBlock = async () => {
    if (!user) return;
    setShowMoreMenu(false);
    try {
      if (blocked) {
        await unblockUser(user.id);
        showGlobalToast(`Unblocked @${user.username || "user"}`);
      } else {
        await blockUser(user.id);
        setShowBlockConfirm(false);
        showGlobalToast(`Blocked @${user.username || "user"}`);
      }
      void loadUserProfile();
    } catch (error) {
      showGlobalToast(getErrorMessage(error, "Couldn't update block"));
    }
  };

  // Visiting your own id should show your editable profile.
  if (userId && myId !== null && Number(userId) === myId) {
    return <Navigate to="/profile" replace />;
  }

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
                  {user.isPrivate && (
                    <span className="sc-lock" title="Private account" aria-label="Private account">
                      🔒
                    </span>
                  )}
                </h1>
                {user.name && <p className="user-full-name">{user.name}</p>}
                <div className="sc-profile-meta">
                  {presenceLabel(user) && (
                    <span className={`sc-presence ${user.isOnline ? "online" : ""}`}>
                      <span className="sc-presence-dot" />
                      {presenceLabel(user)}
                    </span>
                  )}
                  {user.followsYou && <span className="sc-follows-you">Follows you</span>}
                </div>
              </div>

              {/* Action Buttons: Follow, Message, Share */}
              <div className="user-actions-row">
                {!blocked && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`user-btn-follow ${isFollowing || isRequested ? "following" : ""}`}
                >
                  {isRequested ? (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 7 12 12 15 14" />
                      </svg>
                      <span>Requested</span>
                    </>
                  ) : isFollowing ? (
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
                      <span>{user.followsYou ? "Follow back" : "Follow"}</span>
                    </>
                  )}
                </button>
                )}

                {currentUserId !== null && currentUserId !== Number(user.id) && !blocked && user.canMessage !== false && (
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

                <div className="sc-more-wrap">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu((v) => !v)}
                    className="user-btn-icon"
                    title="More options"
                    aria-haspopup="menu"
                    aria-expanded={showMoreMenu}
                  >
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="sc-menu-backdrop" onClick={() => setShowMoreMenu(false)} />
                      <div className="sc-dropdown" role="menu">
                        {!blocked && (
                          <button role="menuitem" onClick={() => void toggleMute()}>
                            {muted ? "🔊 Unmute" : "🔇 Mute"} @{user.username || "user"}
                          </button>
                        )}
                        <button
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            if (blocked) void toggleBlock();
                            else {
                              setShowMoreMenu(false);
                              setShowBlockConfirm(true);
                            }
                          }}
                        >
                          {blocked ? "✅ Unblock" : "⛔ Block"} @{user.username || "user"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

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
                <span className="user-stat-number">
                  {user.canViewContent === false ? user.postsCount ?? 0 : ownPosts.length}
                </span>
                <span className="user-stat-label">Posts</span>
              </div>
              <div
                className="user-stat-card sc-clickable"
                onClick={() => user.canViewContent !== false && navigate(`/user/${user.id}/followers`)}
              >
                <span className="user-stat-number">{followStats.followersCount}</span>
                <span className="user-stat-label">Followers</span>
              </div>
              <div
                className="user-stat-card sc-clickable"
                onClick={() => user.canViewContent !== false && navigate(`/user/${user.id}/following`)}
              >
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
          {blocked ? (
            <div className="user-posts-empty">
              <div className="user-posts-empty-icon">⛔</div>
              <h3>You blocked this account</h3>
              <p>Unblock @{user.username || "user"} from the ⋯ menu to see their posts.</p>
            </div>
          ) : user.canViewContent === false ? (
            <div className="user-posts-empty sc-private-notice">
              <div className="user-posts-empty-icon">🔒</div>
              <h3>This account is private</h3>
              <p>
                {isRequested
                  ? "Your follow request is pending. You'll see their posts once they accept."
                  : `Follow @${user.username || "user"} to see their photos and posts.`}
              </p>
            </div>
          ) : displayedPosts.length === 0 ? (
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
                        color: readableTextColor(post.backgroundColor || "#6366f1"),
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
        {selectedPost && createPortal(
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
          </div>,
          document.body
        )}

        <ConfirmModal
          isOpen={showBlockConfirm}
          title={`Block @${user.username || "user"}?`}
          message="They won't be able to find your profile, see your posts or message you. They won't be notified that you blocked them."
          confirmText="Block"
          onConfirm={() => void toggleBlock()}
          onCancel={() => setShowBlockConfirm(false)}
        />

        {/* Toast notification */}
        {toastMsg && createPortal(
          <div className="user-profile-toast">
            {toastMsg}
          </div>,
          document.body
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default UserProfile;
