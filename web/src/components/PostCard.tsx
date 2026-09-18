import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "./PostCard.css";

interface Post {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  fontSize?: number;
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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editBackground, setEditBackground] = useState(post.backgroundColor || "#F3F4F6");
  const [editFontSize, setEditFontSize] = useState(post.fontSize || 22);
  const [saving, setSaving] = useState(false);

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

  const deletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to delete post");
    }
  };

  const saveEdit = async () => {
    try {
      setSaving(true);
      await api.patch(`/posts/${post.id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
        backgroundColor: editBackground,
        fontSize: editFontSize,
      });
      setShowEdit(false);
      setShowMenu(false);
      window.dispatchEvent(new Event("posts-changed"));
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to update post");
    } finally {
      setSaving(false);
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
    setCurrentUserId(getUserIdFromToken());
    loadLikes();
    loadComments();
  }, [post.id]);

  return (
    <article className="post-card">
      {currentUserId === Number(post.authorId) && (
        <div className="post-menu">
          <button className="post-menu-button" onClick={() => setShowMenu((v) => !v)}>⋯</button>
          {showMenu && (
            <div className="post-menu-dropdown">
              <button onClick={() => { setEditTitle(post.title); setEditContent(post.content || ""); setEditBackground(post.backgroundColor || "#F3F4F6"); setEditFontSize(post.fontSize || 22); setShowEdit(true); setShowMenu(false); }}>Edit</button>
              <button className="delete-action" onClick={deletePost}>Delete</button>
            </div>
          )}
        </div>
      )}
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

      {!post.imageUrl ? (
        <div className="text-post-content" style={{ backgroundColor: post.backgroundColor || "#F3F4F6", color: (post.backgroundColor || "") === "#111827" ? "#fff" : "#111827", fontSize: post.fontSize || 22 }}>
          {post.title}
        </div>
      ) : null}

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

      {showEdit && (
        <div className="edit-overlay" onClick={() => !saving && setShowEdit(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-header">
              <h2>Edit Post</h2>
              <button onClick={() => !saving && setShowEdit(false)}>×</button>
            </div>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Post title" />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Write something..." />
            {!post.imageUrl && (
              <>
                <label>Background</label>
                <div className="edit-colors">
                  {["#F3F4F6","#FFF3E0","#FFE4E6","#E0F2FE","#DCFCE7","#EDE9FE","#FFF7ED","#111827"].map((color) => (
                    <button key={color} type="button" className={editBackground === color ? "edit-color selected" : "edit-color"} style={{backgroundColor: color}} onClick={() => setEditBackground(color)} />
                  ))}
                </div>
                <label>Font size: {editFontSize}px</label>
                <input type="range" min="16" max="40" value={editFontSize} onChange={(e) => setEditFontSize(Number(e.target.value))} />
              </>
            )}
            <div className="edit-actions">
              <button className="cancel-edit" onClick={() => !saving && setShowEdit(false)}>Cancel</button>
              <button className="save-edit" disabled={saving || !editTitle.trim()} onClick={saveEdit}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default PostCard;
