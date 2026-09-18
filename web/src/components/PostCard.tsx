import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "./PostCard.css";

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

interface Comment {
  id: number;
  content: string;
  username?: string;
  name?: string;
}

interface Props {
  post: Post;
}

function PostCard({ post }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");

  const loadLikes = async () => {
    try {
      const response = await api.get(`/likes/${post.id}`);

      setLikeCount(response.data.likeCount);

      const userId = getUserIdFromToken();

      const userLiked = response.data.likes.some(
        (like: { userId: number }) => like.userId === userId,
      );

      setLiked(userLiked);
    } catch (error) {
      console.error(error);
    }
  };

  const loadComments = async () => {
    try {
      const response = await api.get(`/comments/${post.id}`);
      setComments(response.data.comments);
    } catch (error) {
      console.error(error);
    }
  };

  const getUserIdFromToken = (): number | null => {
    const token = localStorage.getItem("accessToken");

    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub;
    } catch {
      return null;
    }
  };

  const toggleLike = async () => {
    try {
      if (liked) {
        await api.delete(`/likes/${post.id}`);
        setLiked(false);
        setLikeCount((count) => count - 1);
      } else {
        await api.post(`/likes/${post.id}`);
        setLiked(true);
        setLikeCount((count) => count + 1);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;

    try {
      await api.post(`/comments/${post.id}`, {
        content: comment,
      });

      setComment("");
      loadComments();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadLikes();
    loadComments();
  }, [post.id]);

  return (
    <article className="post-card">
      <div className="post-header">
        <div className="avatar">
          {(post.author?.username || "U")[0].toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <strong 
            style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => navigate(`/user/${post.authorId}`)}
          >
            {post.author?.username || "User"}
          </strong>

          {post.author?.name && (
            <small>
              {post.author.name}
            </small>
          )}
        </div>
      </div>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.title}
          className="post-image"
        />
      )}

      <div className="post-content">
        <button
          onClick={toggleLike}
          className={liked ? "like-btn liked" : "like-btn"}
        >
          {liked ? "❤️" : "🤍"} <span style={{ fontSize: '14px', fontWeight: 600 }}>{likeCount}</span>
        </button>

        <div style={{ marginTop: '8px' }}>
          <strong 
            style={{ fontSize: '14px', marginRight: '8px', cursor: 'pointer' }}
            onClick={() => navigate(`/user/${post.authorId}`)}
          >
            {post.author?.username || "User"}
          </strong>
          <span style={{ fontSize: '14px' }}>{post.title}</span>
        </div>

        {post.content && (
          <p style={{ marginTop: '4px' }}>{post.content}</p>
        )}

        <div className="comments">
          {comments.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              {comments.map((item) => (
                <div key={item.id} className="comment">
                  <strong>
                    {item.username || item.name || "User"}
                  </strong>
                  <span>{item.content}</span>
                </div>
              ))}
            </div>
          )}

          <div className="comment-input">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addComment();
                }
              }}
            />

            {comment.trim() && (
              <button onClick={addComment}>
                Post
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default PostCard;
