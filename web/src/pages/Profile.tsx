import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
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

  const [bio, setBio] = useState("");
  const [image, setImage] = useState<File | null>(null);

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
          <p>Loading profile...</p>
        </main>
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
            <h1>{user.username}</h1>

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

            <textarea
              value={bio}
              onChange={(e) =>
                setBio(e.target.value)
              }
              placeholder="Write your bio..."
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setImage(
                  e.target.files?.[0] || null,
                )
              }
            />

            <button onClick={updateProfile}>
              Save Profile
            </button>
          </div>
        </section>

        <section className="my-posts">
          <h2>My Posts</h2>

          {posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            <div className="posts-grid">
              {posts.map((post) => (
                <div
                  className="grid-post"
                  key={post.id}
                >
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                    />
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
