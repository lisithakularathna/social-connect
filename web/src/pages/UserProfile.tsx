import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import api from "../api/api";

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
}

interface FollowStats {
  followersCount: number;
  followingCount: number;
}

function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [followStats, setFollowStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

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

      // Follow status is optional: a failure here must not hide the Message button.
      try {
        const followCheckRes = await api.get(`/follows/check/${userId}`);
        setIsFollowing(Boolean(followCheckRes.data?.isFollowing));
      } catch {
        setIsFollowing(false);
      }

      // Store current user ID to decide whether to show Message button
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
    if (!userId) return;

    try {
      if (isFollowing) {
        await api.delete(`/follows/${userId}`);
        setIsFollowing(false);
        setFollowStats(prev => ({
          ...prev,
          followersCount: prev.followersCount - 1,
        }));
      } else {
        await api.post(`/follows/${userId}`);
        setIsFollowing(true);
        setFollowStats(prev => ({
          ...prev,
          followersCount: prev.followersCount + 1,
        }));
      }
      // Refresh profile data without hiding the Message button.
      await loadUserProfile();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="profile-page">
          <div className="loading">
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
        <main className="profile-page">
          <div className="empty">
            <h2>User not found</h2>
          </div>
        </main>
        
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="profile-page">
        <section className="profile-header">
          <div className="profile-image-container">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                className="profile-image"
                alt="Profile"
              />
            ) : (
              <div className="profile-placeholder">
                {(user.username || "U")[0].toUpperCase()}
              </div>
            )}
          </div>

          <div className="profile-info">
            <div className="profile-actions">
              <h1>{user.username}</h1>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={toggleFollow}
                  className={isFollowing ? "follow-btn following" : "follow-btn"}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                {currentUserId !== null && currentUserId !== Number(user.id) && (
                  <button
                    onClick={() => navigate(`/messages/${userId}`)}
                    className="message-btn"
                  >
                    Message
                  </button>
                )}
              </div>
            </div>

            {user.name && <h3>{user.name}</h3>}

            <div className="profile-stats">
              <div className="stat">
                <strong>{posts.length}</strong>
                <span>posts</span>
              </div>
              <div className="stat">
                <strong>{followStats.followersCount}</strong>
                <span>followers</span>
              </div>
              <div className="stat">
                <strong>{followStats.followingCount}</strong>
                <span>following</span>
              </div>
            </div>

            {user.bio && <p className="bio">{user.bio}</p>}
          </div>
        </section>

        <section className="my-posts">
          <h2>Posts</h2>

          {posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            <div className="posts-grid">
              {posts.map((post) => (
                <div
                  className="grid-post"
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  title={post.title}
                >
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} />
                  ) : (
                    <div
                      className="text-post-preview"
                      style={{
                        backgroundColor: post.backgroundColor || "#F3F4F6",
                        color:
                          (post.backgroundColor || "") === "#111827"
                            ? "#fff"
                            : "#111827",
                        fontSize: `${Math.min(Math.max((post.fontSize || 20) * 0.7, 13), 20)}px`,
                      }}
                    >
                      {post.title}
                    </div>
                  )}
                  <div className="grid-post-overlay">
                    <span className="grid-post-overlay-title">{post.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
      </main>
      
      <BottomNav />
    </>
  );
}

export default UserProfile;
