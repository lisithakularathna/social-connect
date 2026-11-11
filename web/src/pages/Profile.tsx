import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import api, { getErrorMessage } from "../api/api";
import { refreshCurrentUser } from "../utils/session";
import { readableTextColor } from "../utils/color";
import "./Profile.css";

interface User {
  id: number;
  email: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
  isPrivate?: boolean;
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
}

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "reposts">("posts");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [followStats, setFollowStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleShareProfile = () => {
    if (navigator.clipboard && user) {
      const url = `${window.location.origin}/user/${user.id}`;
      navigator.clipboard.writeText(url);
      showToast("Profile link copied to clipboard! 📋");
    }
  };

  const loadProfile = async () => {
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
      setBio(response.data.bio || "");
      setEditName(response.data.name || "");
      setEditUsername(response.data.username || "");

      // Load follow stats
      const statsResponse = await api.get(`/follows/stats/${response.data.id}`);
      setFollowStats(statsResponse.data);
    } catch (error) {
      console.error("Load profile error:", error);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await api.get("/posts/me");
      setPosts(response.data);
    } catch (error) {
      console.error("Load posts error:", error);
    }
  };

  // Saved posts live on the server, so they're the same on every device.
  const loadSavedPosts = async () => {
    try {
      const { data } = await api.get("/posts/saved");
      setSavedPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading saved posts:", err);
      setSavedPosts([]);
    }
  };

  const openEditor = () => {
    if (!user) return;
    setEditName(user.name || "");
    setEditUsername(user.username || "");
    setBio(user.bio || "");
    setImage(null);
    setImagePreview(null);
    setEditError(null);
    setIsEditing(true);
  };

  const updateProfile = async () => {
    if (savingProfile) return;
    const username = editUsername.trim();
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      setEditError('Username must be 3-30 characters: letters, numbers, "_" or "."');
      return;
    }
    setSavingProfile(true);
    setEditError(null);
    try {
      const formData = new FormData();
      formData.append("name", editName.trim());
      formData.append("username", username);
      formData.append("bio", bio.trim());
      if (image) {
        formData.append("image", image);
      }
      await api.patch("/users/me", formData);
      await loadProfile();
      void refreshCurrentUser();
      setIsEditing(false);
      showToast("Profile updated ✓");
    } catch (error) {
      setEditError(getErrorMessage(error, "Failed to update profile"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePostChange = () => {
    loadPosts();
    loadSavedPosts();
    setSelectedPost(null);
  };

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadSavedPosts();
  }, []);

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="profile-page">
          <div className="empty">
            <p>Loading profile...</p>
          </div>
        </main>
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

  // Active list based on selected tab
  const displayedPosts =
    activeTab === "posts"
      ? ownPosts
      : activeTab === "saved"
      ? savedPosts
      : reposts;

  return (
    <>
      <Navbar />

      <main className="profile-page">
        {/* ── Hero Profile Card (Modern Glassmorphic Hero) ── */}
        <section className="profile-hero-card">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-ring">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.username || "Profile"}
                  className="profile-avatar-img"
                />
              ) : (
                <div className="profile-avatar-fallback">
                  {(user.username || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="profile-info-col">
            <div className="profile-title-row">
              <div className="profile-identity">
                <h1 className="profile-main-username">
                  {user.username}
                  {user.isPrivate && (
                    <span
                      className="sc-lock sc-clickable"
                      title="Private account — manage follow requests"
                      onClick={() => navigate("/activity?tab=requests")}
                    >
                      🔒
                    </span>
                  )}
                </h1>
                {user.name && <p className="profile-full-name">{user.name}</p>}
              </div>

              <div className="profile-actions-row">
                <button
                  type="button"
                  className="profile-btn-edit"
                  onClick={openEditor}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="profile-btn-icon"
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

                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="profile-btn-icon"
                  title="Settings"
                  aria-label="Settings"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats row with interactive feel */}
            <div className="profile-stats-bar">
              <div className="profile-stat-card" onClick={() => setActiveTab("posts")}>
                <span className="profile-stat-number">{ownPosts.length}</span>
                <span className="profile-stat-label">Posts</span>
              </div>
              <div className="profile-stat-card" onClick={() => navigate("/followers")}>
                <span className="profile-stat-number">{followStats.followersCount}</span>
                <span className="profile-stat-label">Followers</span>
              </div>
              <div className="profile-stat-card" onClick={() => navigate("/following")}>
                <span className="profile-stat-number">{followStats.followingCount}</span>
                <span className="profile-stat-label">Following</span>
              </div>
            </div>

            {/* Bio */}
            {user.bio && <p className="profile-bio-text">{user.bio}</p>}
          </div>
        </section>

        {/* ── Profile Tabs: POSTS / SAVED / REPOSTS ── */}
        <div className="profile-tabs-nav">
          <button
            className={`profile-tab-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            <span className="tab-icon">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <span>POSTS</span>
            <span className="tab-badge">{ownPosts.length}</span>
          </button>

          <button
            className={`profile-tab-btn ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("saved");
              loadSavedPosts();
            }}
          >
            <span className="tab-icon">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span>SAVED</span>
            <span className="tab-badge">{savedPosts.length}</span>
          </button>

          <button
            className={`profile-tab-btn ${activeTab === "reposts" ? "active" : ""}`}
            onClick={() => setActiveTab("reposts")}
          >
            <span className="tab-icon">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
            <span>REPOSTS</span>
            <span className="tab-badge">{reposts.length}</span>
          </button>
        </div>

        {/* ── Tab Content: Posts Grid ── */}
        <section className="profile-tab-content">
          {displayedPosts.length === 0 ? (
            <div className="empty">
              {activeTab === "posts" && (
                <>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>📸</div>
                  <h2>No posts yet</h2>
                  <p>When you share photos or text, they will appear here.</p>
                </>
              )}
              {activeTab === "saved" && (
                <>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔖</div>
                  <h2>No saved posts</h2>
                  <p>Save posts to your bookmarks to view them later.</p>
                </>
              )}
              {activeTab === "reposts" && (
                <>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>↻</div>
                  <h2>No reposts yet</h2>
                  <p>Repost posts from your feed to share them with your followers.</p>
                </>
              )}
            </div>
          ) : (
            <div className="posts-grid">
              {displayedPosts.map((post) => (
                <div
                  className="grid-post"
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  title={post.title}
                >
                  {/* Badge indicator for Repost or Saved */}
                  {activeTab === "reposts" && (
                    <div className="grid-post-type-tag">
                      <span>↻</span> Repost
                    </div>
                  )}
                  {activeTab === "saved" && (
                    <div className="grid-post-type-tag">
                      <span>🔖</span> Saved
                    </div>
                  )}

                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} />
                  ) : (
                    <div
                      className="text-post-preview"
                      style={{
                        backgroundColor: post.backgroundColor || "#F3F4F6",
                        color: readableTextColor(post.backgroundColor || "#F3F4F6"),
                        fontSize: `${Math.min(Math.max((post.fontSize || 20) * 0.7, 13), 20)}px`,
                      }}
                    >
                      {post.title}
                    </div>
                  )}

                  {/* Hover overlay with post info */}
                  <div className="grid-post-overlay">
                    <span className="grid-post-overlay-title">{post.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Post Detail Modal (Clicking post in grid) ── */}
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
                onDelete={handlePostChange}
              />
            </div>
          </div>,
          document.body
        )}

        {/* ── Edit Profile Modal ── */}
        {isEditing && createPortal(
          <div className="edit-overlay" onClick={() => setIsEditing(false)}>
            <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="edit-header">
                <h2>Edit Profile</h2>
                <button onClick={() => setIsEditing(false)}>×</button>
              </div>

              <div className="edit-form-group">
                <label>Profile Picture</label>
                <div className="edit-avatar-preview">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" />
                  ) : user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="Current" />
                  ) : (
                    <div className="avatar-placeholder">
                      {(user.username || "U")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImage(file);
                    if (file) setImagePreview(URL.createObjectURL(file));
                  }}
                  className="file-input"
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="edit-name">Name</label>
                <input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                  maxLength={60}
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.replace(/\s/g, ""))}
                  placeholder="username"
                  maxLength={30}
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="edit-bio">
                  Bio <span className="sc-char-count">{bio.length}/150</span>
                </label>
                <textarea
                  id="edit-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  maxLength={150}
                />
              </div>

              {editError && <div className="sc-inline-error" role="alert">{editError}</div>}

              <div className="edit-actions">
                <button
                  className="cancel-edit"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button
                  className="save-edit"
                  onClick={() => void updateProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Toast notification */}
        {toastMsg && createPortal(
          <div className="profile-toast">
            {toastMsg}
          </div>,
          document.body
        )}
      </main>

      <BottomNav />
    </>
  );
}

export default Profile;
