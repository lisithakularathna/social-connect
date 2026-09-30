import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
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
  imageUrl?: string;
}

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followStats, setFollowStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const loadProfile = async () => {
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
      setBio(response.data.bio || "");
      
      // Load follow stats
      const statsResponse = await api.get(`/follows/stats/${response.data.id}`);
      setFollowStats(statsResponse.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await api.get("/posts/me");
      setPosts(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostDeleted = () => {
    loadPosts(); // Reload posts after delete
  };

  const updateProfile = async () => {
    try {
      const formData = new FormData();

      formData.append("bio", bio);

      if (image) {
        formData.append("image", image);
      }

      await api.patch("/users/me", formData);

      await loadProfile();

      alert("Profile updated successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to update profile");
    }
  };

  useEffect(() => {
    loadProfile();
    loadPosts();
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

  return (
    <>
      <Navbar />

      <main className="profile-page">
        <header className="profile-header">
          <div className="profile-avatar-section">
            <div className="profile-avatar">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">{(user.username || "U")[0].toUpperCase()}</div>
              )}
            </div>
          </div>
          
          <div className="profile-details-section">
            <div className="profile-title-row">
              <h1 className="profile-username">{user.username}</h1>
              <div className="profile-actions">
                <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
                <button className="message-btn" onClick={() => navigate(`/messages/${user.id}`)} title="Test Messaging">✉</button>
              </div>
            </div>

            <div className="profile-stats">
              <div className="stat"><strong>{posts.length}</strong> posts</div>
              <div className="stat"><strong>{followStats.followersCount}</strong> followers</div>
              <div className="stat"><strong>{followStats.followingCount}</strong> following</div>
            </div>

            <div className="profile-bio-section">
              {user.name && <h2 className="profile-name">{user.name}</h2>}
              {user.bio && <p className="profile-bio">{user.bio}</p>}
            </div>
          </div>
        </header>

        {isEditing && (
          <div className="edit-overlay" onClick={() => setIsEditing(false)}>
            <div className="edit-modal" onClick={e => e.stopPropagation()}>
              <div className="edit-header">
                <h2>Edit Profile</h2>
                <button onClick={() => setIsEditing(false)}>×</button>
              </div>
              
              <div className="edit-form-group">
                <label>Profile Picture</label>
                <div className="edit-avatar-preview">
                  {imagePreview ? <img src={imagePreview} alt="Preview" /> : (user.profileImageUrl ? <img src={user.profileImageUrl} alt="Current" /> : <div className="avatar-placeholder">{(user.username || "U")[0].toUpperCase()}</div>)}
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
                <label>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write something about yourself..."
                  maxLength={150}
                />
              </div>

              <div className="edit-actions">
                <button className="cancel-edit" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="save-edit" onClick={() => { updateProfile(); setIsEditing(false); }}>Save Changes</button>
              </div>
            </div>
          </div>
        )}

        <div className="profile-tabs">
          <div className="tab active">POSTS</div>
        </div>

        <section className="my-posts">
          {posts.length === 0 ? (
            <div className="empty">
              <h2>No posts yet</h2>
              <p>When you share photos, they will appear on your profile.</p>
            </div>
          ) : (
            <div className="posts-grid">
              {posts.map((post) => (
                <div className="grid-post" key={post.id}>
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} />
                  ) : (
                    <div className="text-post-preview">
                      <p>{post.title.length > 50 ? post.title.substring(0, 50) + '...' : post.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default Profile;
