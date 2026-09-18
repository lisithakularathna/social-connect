import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import PostCard from "../components/PostCard";
import api from "../api/api";

interface Post {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  authorId: number;
  author?: {
    username?: string;
    name?: string;
    profileImageUrl?: string;
  };
}

function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    try {
      setError(null);
      const response = await api.get("/posts");
      console.log("Posts loaded:", response.data);
      setPosts(response.data);
    } catch (error: any) {
      console.error("Error loading posts:", error);
      setError(error.response?.data?.message || error.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <>
      <Navbar />

      <main className="feed-page">
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
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default Home;
