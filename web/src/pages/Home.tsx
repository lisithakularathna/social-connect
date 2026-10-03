import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import PostCard from "../components/PostCard";
import StoriesBar from "../components/StoriesBar";
import api from "../api/api";

interface Post {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  authorId: number;
  author?: {
    id?: number;
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
  createdAt?: string;
}

interface CurrentUser {
  id: number;
  username?: string;
  profileImageUrl?: string;
}

function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = async () => {
    try {
      const res = await api.get("/users/me");
      if (res.data) {
        setAccount({
          id: res.data.id,
          username: res.data.username || res.data.name,
          profileImageUrl: res.data.profileImageUrl,
        });
      }
    } catch (err) {
      console.error("Failed to load user info:", err);
    }
  };

  const loadPosts = async () => {
    try {
      setError(null);
      const response = await api.get("/posts");
      console.log("Posts loaded:", response.data);
      setPosts(response.data.posts || response.data); // Fallback in case it's actually an array
    } catch (error: any) {
      console.error("Error loading posts:", error);
      setError(error.response?.data?.message || error.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
    loadPosts();
  }, []);

  return (
    <>
      <Navbar />

      <main className="feed-page">
        {/* Stories Section at the top */}
        <StoriesBar posts={posts} currentUser={account} />

        {loading ? (
          <div className="loading">
            <p>Loading posts...</p>
          </div>
        ) : error ? (
          <div className="empty">
            <h2>Error</h2>
            <p>{error}</p>
            <button 
              onClick={loadPosts}
              style={{ 
                marginTop: '16px', 
                padding: '10px 20px', 
                background: '#0095f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty">
            <h2>No posts yet</h2>
            <p>Be the first person to create a post.</p>
          </div>
        ) : (
          <div className="feed">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={loadPosts}
              />
            ))}
          </div>
        )}
      </main>
      
      <BottomNav />
    </>
  );
}

export default Home;
