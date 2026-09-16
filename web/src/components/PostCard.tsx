import { useEffect, useState } from "react";
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

        <div>
          <strong>
            {post.author?.username || "User"}
          </strong>

          <small>
            {post.author?.name || ""}
          </small>
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
        <h3>{post.title}</h3>

        {post.content && <p>{post.content}</p>}

        <button
          onClick={toggleLike}
          className={liked ? "like-btn liked" : "like-btn"}
        >
          {liked ? "♥" : "♡"} {likeCount}
        </button>

        <div className="comments">
          <h4>Comments</h4>

          {comments.map((item) => (
            <div key={item.id} className="comment">
              <strong>
                {item.username || item.name || "User"}
              </strong>

              <span>{item.content}</span>
            </div>
          ))}

          <div className="comment-input">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
            />

            <button onClick={addComment}>
              Send
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default PostCard;
