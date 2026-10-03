import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import ConfirmModal from "./ConfirmModal";
import "./PostCard.css";

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

interface Comment {
  id: number;
  content: string;
  userId?: number;
  username?: string;
  name?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  isEdited?: boolean;
}

interface Props {
  post: Post;
  onDelete?: () => void;
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

function PostCard({ post, onDelete }: Props) {
  const navigate = useNavigate();

  // Current user
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    id?: number;
    username?: string;
    profileImageUrl?: string;
  } | null>(null);

  // Like state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loadingLike, setLoadingLike] = useState(false);

  // Save / Bookmark state
  const [isSaved, setIsSaved] = useState(false);

  // Repost state
  const [isReposting, setIsReposting] = useState(false);
  const [isReposted, setIsReposted] = useState(false);

  // Share popover state
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [modalCommentText, setModalCommentText] = useState("");
  const [submittingModalComment, setSubmittingModalComment] = useState(false);

  // Edit / Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editBackground, setEditBackground] = useState(post.backgroundColor || "#F3F4F6");
  const [editFontSize, setEditFontSize] = useState(post.fontSize || 22);
  const [saving, setSaving] = useState(false);

  // Delete confirmation modals
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  // Comment edit & menu state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<number | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
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

  // Check saved state from localStorage (matching mobile app logic)
  const checkIfSaved = (postId: number): boolean => {
    try {
      const raw = localStorage.getItem("savedPosts");
      if (!raw) return false;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return false;
      return list.some((item: any) =>
        item && typeof item === "object" ? Number(item.id) === postId : Number(item) === postId
      );
    } catch {
      return false;
    }
  };

  const toggleSave = () => {
    try {
      const raw = localStorage.getItem("savedPosts");
      const list: any[] = raw ? JSON.parse(raw) : [];
      const alreadySaved = list.some((item: any) =>
        item && typeof item === "object" ? Number(item.id) === post.id : Number(item) === post.id
      );

      let updated: any[];
      if (alreadySaved) {
        updated = list.filter((item: any) =>
          item && typeof item === "object" ? Number(item.id) !== post.id : Number(item) !== post.id
        );
        setIsSaved(false);
        showToast("Post removed from saved");
      } else {
        // Save post object
        updated = [post, ...list];
        setIsSaved(true);
        showToast("Post saved to bookmarks");
      }
      localStorage.setItem("savedPosts", JSON.stringify(updated));
    } catch (e) {
      console.error("Save post error:", e);
      showToast("Could not update bookmark");
    }
  };

  // Repost post (calls backend POST /posts/repost/:id)
  const handleRepost = async () => {
    if (isReposting) return;
    try {
      setIsReposting(true);
      await api.post(`/posts/repost/${post.id}`);
      setIsReposted(true);
      showToast("↻ Post reposted to your feed!");
      if (onDelete) {
        // Refresh feed after slight delay
        setTimeout(() => {
          onDelete();
        }, 1200);
      }
    } catch (error: any) {
      console.error("Repost error:", error);
      showToast(error.response?.data?.message || "Failed to repost");
    } finally {
      setIsReposting(false);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    if (activeCommentMenuId === null) return;
    const handleOutsideClick = () => setActiveCommentMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [activeCommentMenuId]);

  // Likes
  const loadLikes = async () => {
    try {
      const response = await api.get(`/likes/${post.id}`);
      setLikeCount(response.data.likeCount);

      const userId = getUserIdFromToken();
      if (userId && response.data.likes) {
        const userLiked = response.data.likes.some(
          (like: { userId: number }) => like.userId === userId
        );
        setLiked(userLiked);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const toggleLike = async () => {
    if (loadingLike) return;
    try {
      setLoadingLike(true);
      if (liked) {
        setLiked(false);
        setLikeCount((count) => Math.max(0, count - 1));
        await api.delete(`/likes/${post.id}`);
      } else {
        setLiked(true);
        setLikeCount((count) => count + 1);
        await api.post(`/likes/${post.id}`);
      }
    } catch (error) {
      console.error(error);
      // Revert if error
      loadLikes();
    } finally {
      setLoadingLike(false);
    }
  };

  // Comments
  const loadComments = async () => {
    try {
      const response = await api.get(`/comments/${post.id}`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error(error);
    }
  };

  const addComment = async (text: string, isModal = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isModal) setSubmittingModalComment(true);
    else setSubmittingComment(true);

    try {
      await api.post(`/comments/${post.id}`, {
        content: trimmed,
      });

      if (isModal) {
        setModalCommentText("");
      } else {
        setCommentText("");
      }

      await loadComments();
      showToast("Comment posted!");
    } catch (error: any) {
      console.error("Add comment error:", error);
      showToast(error.response?.data?.message || "Failed to post comment");
    } finally {
      if (isModal) setSubmittingModalComment(false);
      else setSubmittingComment(false);
    }
  };

  const startEditComment = (comment: Comment) => {
    setActiveCommentMenuId(null);
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditComment = async (commentId: number) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;

    try {
      setSavingComment(true);
      await api.patch(`/comments/${commentId}`, { content: trimmed });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, content: trimmed, isEdited: true } : c
        )
      );
      setEditingCommentId(null);
      setEditingCommentText("");
      showToast("Comment updated");
    } catch (error: any) {
      console.error("Edit comment error:", error);
      showToast(error.response?.data?.message || "Failed to update comment");
    } finally {
      setSavingComment(false);
    }
  };

  const executeDeleteComment = async () => {
    if (deleteCommentId === null) return;
    try {
      setIsDeletingComment(true);
      await api.delete(`/comments/${deleteCommentId}`);
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId));
      setDeleteCommentId(null);
      showToast("Comment deleted");
    } catch (error: any) {
      console.error("Delete comment error:", error);
      showToast(error.response?.data?.message || "Failed to delete comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  // Post Actions
  const executeDeletePost = async () => {
    try {
      setIsDeletingPost(true);
      await api.delete(`/posts/${post.id}`);
      setShowDeletePostConfirm(false);
      showToast("Post deleted");
      if (onDelete) {
        onDelete();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to delete post");
    } finally {
      setIsDeletingPost(false);
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
      showToast("Post updated");
      if (onDelete) {
        onDelete();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  // Direct Message & Share
  const handleOpenMessages = () => {
    setShowShareMenu(false);
    navigate(`/messages/${post.authorId}`);
  };

  const handleCopyLink = () => {
    setShowShareMenu(false);
    const link = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(link);
    showToast("Link copied to clipboard!");
  };

  const handleNativeShare = async () => {
    setShowShareMenu(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.content || post.title,
          url: window.location.href,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  useEffect(() => {
    const uid = getUserIdFromToken();
    setCurrentUserId(uid);
    setIsSaved(checkIfSaved(post.id));
    loadLikes();
    loadComments();

    // Fetch me for current user avatar
    api
      .get("/users/me")
      .then((res) => {
        if (res.data) {
          setCurrentUserProfile(res.data);
        }
      })
      .catch(() => {});
  }, [post.id]);

  // Preview comments: up to 2 comments shown under post
  const previewComments = comments.slice(0, 2);

  return (
    <article className="post-card" id={`post-${post.id}`}>
      {/* Toast Feedback */}
      {toastMessage && <div className="post-toast">{toastMessage}</div>}

      {/* 3-dots Menu for Post Author */}
      {currentUserId === Number(post.authorId) && (
        <div className="post-menu">
          <button
            className="post-menu-button"
            title="Post options"
            onClick={() => setShowMenu((v) => !v)}
          >
            ⋯
          </button>
          {showMenu && (
            <div className="post-menu-dropdown">
              <button
                onClick={() => {
                  setEditTitle(post.title);
                  setEditContent(post.content || "");
                  setEditBackground(post.backgroundColor || "#F3F4F6");
                  setEditFontSize(post.fontSize || 22);
                  setShowEdit(true);
                  setShowMenu(false);
                }}
              >
                ✏️ Edit Post
              </button>
              <button
                className="delete-action"
                onClick={() => {
                  setShowMenu(false);
                  setShowDeletePostConfirm(true);
                }}
              >
                🗑️ Delete Post
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post Header */}
      <div className="post-header">
        <div
          className="avatar"
          onClick={() => navigate(`/user/${post.authorId}`)}
          style={{ cursor: "pointer" }}
        >
          {post.author?.profileImageUrl ? (
            <img
              src={post.author.profileImageUrl}
              alt={post.author.username || "User"}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.textContent = (
                    post.author?.username || "U"
                  )[0].toUpperCase();
                }
              }}
            />
          ) : (
            (post.author?.username || "U")[0].toUpperCase()
          )}
        </div>

        <div className="post-header-info">
          <div
            className="post-header-username"
            onClick={() => navigate(`/user/${post.authorId}`)}
          >
            {post.author?.username || "user"}
          </div>
          <div className="post-header-sub">
            {post.author?.name && <span>{post.author.name}</span>}
            {post.author?.name && post.createdAt && (
              <span className="post-dot-separator">•</span>
            )}
            {post.createdAt && (
              <span>{formatTimeAgo(post.createdAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Post Body: Image or Text Post */}
      {!post.imageUrl ? (
        <div
          className="text-post-content"
          style={{
            backgroundColor: post.backgroundColor || "#F3F4F6",
            color: (post.backgroundColor || "") === "#111827" ? "#fff" : "#111827",
            fontSize: post.fontSize || 22,
          }}
        >
          {post.title}
        </div>
      ) : (
        <img src={post.imageUrl} alt={post.title} className="post-image" />
      )}

      {/* Post Actions & Content */}
      <div className="post-content">
        {/* ── Action Row: Like / Comment / Repost / Message / Bookmark (Mobile matching) ── */}
        <div className="post-actions-row">
          {/* Like */}
          <button
            onClick={toggleLike}
            disabled={loadingLike}
            className={`action-btn ${liked ? "liked" : ""}`}
            title={liked ? "Unlike" : "Like"}
          >
            {liked ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowCommentsModal(true)}
            className="action-btn"
            title="Comments"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </button>

          {/* Repost */}
          <button
            onClick={handleRepost}
            disabled={isReposting}
            className={`action-btn ${isReposted ? "reposted" : ""}`}
            title="Repost to feed"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isReposting ? "rotate(180deg)" : "none",
                transition: "transform 0.4s ease",
              }}
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>

          {/* Message / Share */}
          <div style={{ position: "relative" }}>
            <button
              ref={shareBtnRef}
              onClick={() => setShowShareMenu((v) => !v)}
              className="action-btn"
              title="Share or send message"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>

            {showShareMenu && (
              <>
                <div
                  className="share-popover-backdrop"
                  onClick={() => setShowShareMenu(false)}
                />
                <div className="share-popover">
                  <button onClick={handleOpenMessages}>
                    💬 Send Message to @{post.author?.username || "author"}
                  </button>
                  <button onClick={handleCopyLink}>
                    🔗 Copy Post Link
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button onClick={handleNativeShare}>
                      ↗️ Share via Apps...
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="action-btn-spacer" />

          {/* Bookmark / Save */}
          <button
            onClick={toggleSave}
            className={`action-btn ${isSaved ? "saved" : ""}`}
            title={isSaved ? "Remove from bookmarks" : "Save post"}
          >
            {isSaved ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Likes Count */}
        {likeCount > 0 && (
          <div className="post-likes-count">
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </div>
        )}

        {/* Caption */}
        <div className="post-caption">
          <span
            className="post-caption-author"
            onClick={() => navigate(`/user/${post.authorId}`)}
          >
            {post.author?.username || "user"}
          </span>
          <span>{post.title}</span>
          {post.content && <p className="post-body-text">{post.content}</p>}
        </div>

        {/* ── Comments Preview (1 or 2 comments under post) ── */}
        {previewComments.length > 0 && (
          <div className="post-comments-preview">
            {previewComments.map((c) => (
              <div key={c.id} className="preview-comment-item">
                <span
                  className="preview-comment-user"
                  onClick={() => c.userId && navigate(`/user/${c.userId}`)}
                >
                  {c.username || c.name || "user"}
                </span>
                <span className="preview-comment-content">{c.content}</span>
                {c.createdAt && (
                  <span className="preview-comment-time">
                    {formatTimeAgo(c.createdAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── "View all X comments" button (opens full comment section) ── */}
        {comments.length > 2 && (
          <button
            className="view-all-comments-btn"
            onClick={() => setShowCommentsModal(true)}
          >
            View all {comments.length} comments
          </button>
        )}

        {/* ── Quick Inline Comment Input on Card ── */}
        <form
          className="inline-comment-box"
          onSubmit={(e) => {
            e.preventDefault();
            addComment(commentText, false);
          }}
        >
          <div className="inline-comment-avatar">
            {currentUserProfile?.profileImageUrl ? (
              <img
                src={currentUserProfile.profileImageUrl}
                alt={currentUserProfile.username || "me"}
              />
            ) : (
              (currentUserProfile?.username || "U")[0].toUpperCase()
            )}
          </div>
          <input
            className="inline-comment-input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
          />
          {commentText.trim() && (
            <button
              type="submit"
              className="inline-comment-submit"
              disabled={submittingComment}
            >
              {submittingComment ? "..." : "Post"}
            </button>
          )}
        </form>
      </div>

      {/* ── Comments Modal / Full Comments Section ── */}
      {showCommentsModal && (
        <div
          className="comments-modal-overlay"
          onClick={() => setShowCommentsModal(false)}
        >
          <div
            className="comments-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="comments-modal-header">
              <h3>Comments ({comments.length})</h3>
              <button
                className="comments-modal-close"
                onClick={() => setShowCommentsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="comments-modal-list">
              {comments.length === 0 ? (
                <div className="comments-empty-state">
                  <div style={{ fontSize: "28px" }}>💬</div>
                  <strong>No comments yet</strong>
                  <p>Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((item) => {
                  const isMyComment = currentUserId === item.userId;
                  const isEditing = editingCommentId === item.id;

                  return (
                    <div key={item.id} className="modal-comment-card">
                      <div
                        className="avatar"
                        style={{ width: "34px", height: "34px", fontSize: "13px" }}
                        onClick={() =>
                          item.userId && navigate(`/user/${item.userId}`)
                        }
                      >
                        {item.profileImageUrl ? (
                          <img
                            src={item.profileImageUrl}
                            alt={item.username || "User"}
                          />
                        ) : (
                          (item.username || "U")[0].toUpperCase()
                        )}
                      </div>
                      <div className="modal-comment-body">
                        <div className="modal-comment-meta">
                          <span
                            className="modal-comment-username"
                            onClick={() =>
                              item.userId && navigate(`/user/${item.userId}`)
                            }
                          >
                            {item.username || item.name || "user"}
                          </span>
                          {item.createdAt && (
                            <span className="modal-comment-time">
                              {formatTimeAgo(item.createdAt)}
                            </span>
                          )}
                          {item.isEdited && (
                            <span className="comment-edited-badge" title="Comment was edited">
                              edited
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="comment-inline-edit">
                            <textarea
                              className="comment-edit-textarea"
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                            <div className="comment-edit-actions">
                              <button
                                type="button"
                                className="comment-edit-cancel"
                                onClick={cancelEditComment}
                                disabled={savingComment}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="comment-edit-save"
                                onClick={() => saveEditComment(item.id)}
                                disabled={savingComment || !editingCommentText.trim()}
                              >
                                {savingComment ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="modal-comment-text">{item.content}</div>
                        )}
                      </div>

                      {/* Only allow editing / deleting own comment with sleek action menu */}
                      {isMyComment && !isEditing && (
                        <div className="comment-actions-menu-container">
                          <button
                            type="button"
                            className="comment-action-menu-trigger"
                            title="Comment options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCommentMenuId(
                                activeCommentMenuId === item.id ? null : item.id
                              );
                            }}
                          >
                            ···
                          </button>

                          {activeCommentMenuId === item.id && (
                            <div
                              className="comment-action-dropdown"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="comment-dropdown-item"
                                onClick={() => startEditComment(item)}
                              >
                                <span>✏️</span> Edit
                              </button>
                              <button
                                type="button"
                                className="comment-dropdown-item delete"
                                onClick={() => {
                                  setActiveCommentMenuId(null);
                                  setDeleteCommentId(item.id);
                                }}
                              >
                                <span>🗑️</span> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form
              className="comments-modal-footer"
              onSubmit={(e) => {
                e.preventDefault();
                addComment(modalCommentText, true);
              }}
            >
              <input
                value={modalCommentText}
                onChange={(e) => setModalCommentText(e.target.value)}
                placeholder={`Add a comment for @${post.author?.username || "author"}...`}
                autoFocus
              />
              <button
                type="submit"
                disabled={submittingModalComment || !modalCommentText.trim()}
              >
                {submittingModalComment ? "Posting..." : "Post"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Post Modal ── */}
      {showEdit && (
        <div
          className="edit-overlay"
          onClick={() => !saving && setShowEdit(false)}
        >
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-header">
              <h2>Edit Post</h2>
              <button onClick={() => !saving && setShowEdit(false)}>×</button>
            </div>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Post title"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Write something..."
              rows={4}
            />
            {!post.imageUrl && (
              <>
                <label>Background</label>
                <div className="edit-colors">
                  {[
                    "#F3F4F6",
                    "#FFF3E0",
                    "#FFE4E6",
                    "#E0F2FE",
                    "#DCFCE7",
                    "#EDE9FE",
                    "#FFF7ED",
                    "#111827",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        editBackground === color
                          ? "edit-color selected"
                          : "edit-color"
                      }
                      style={{ backgroundColor: color }}
                      onClick={() => setEditBackground(color)}
                    />
                  ))}
                </div>
                <label>Font size: {editFontSize}px</label>
                <input
                  type="range"
                  min="16"
                  max="40"
                  value={editFontSize}
                  onChange={(e) => setEditFontSize(Number(e.target.value))}
                />
              </>
            )}
            <div className="edit-actions">
              <button
                className="cancel-edit"
                onClick={() => !saving && setShowEdit(false)}
              >
                Cancel
              </button>
              <button
                className="save-edit"
                disabled={saving || !editTitle.trim()}
                onClick={saveEdit}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Post Modal */}
      <ConfirmModal
        isOpen={showDeletePostConfirm}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeletingPost}
        onConfirm={executeDeletePost}
        onCancel={() => setShowDeletePostConfirm(false)}
      />

      {/* Delete Comment Modal */}
      <ConfirmModal
        isOpen={deleteCommentId !== null}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeletingComment}
        onConfirm={executeDeleteComment}
        onCancel={() => setDeleteCommentId(null)}
      />
    </article>
  );
}

export default PostCard;
