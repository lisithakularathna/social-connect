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

  const loadPosts = async () => {
    try {
      const response = await api.get("/posts");
      setPosts(response.data);
    } catch (error) {
      console.error(error);
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
        <div className="feed-header">
          <h1>Home</h1>
          <p>Latest posts from Social Connect</p>
        </div>

        {loading ? (
          <p>Loading posts...</p>
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
