import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import type { StoryItem, StoryViewer, StoryReaction } from "./CreateStoryModal";
import "./StoriesBar.css";

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: StoryItem[];
  initialIndex?: number;
  currentUser?: {
    id: number;
    username?: string;
    profileImageUrl?: string;
    name?: string;
  } | null;
  currentUserId?: number | null;
  onDeleteStory?: (storyId: string) => void;
  onRecordView?: (storyId: string, viewer: StoryViewer) => void;
  onAddReaction?: (storyId: string, reaction: StoryReaction) => void;
}

interface FloatingParticle {
  id: number;
  emoji: string;
  left: number;
}

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮", "😢"];

export default function StoryViewerModal({
  isOpen,
  onClose,
  stories,
  initialIndex = 0,
  currentUser,
  currentUserId,
  onDeleteStory,
  onRecordView,
  onAddReaction,
}: StoryViewerModalProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState<string | null>(null);
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [floatingParticles, setFloatingParticles] = useState<FloatingParticle[]>([]);
  const recordedViewsRef = useRef<Set<string>>(new Set());

  const activeUserId = currentUser?.id || currentUserId;

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
    setReplyText("");
    setShowViewersSheet(false);
    setReplyFeedback(null);
  }, [initialIndex, isOpen]);

  const currentStory = stories[currentIndex];
  const isMyStory = Boolean(activeUserId && currentStory && activeUserId === currentStory.userId);

  // Automatically record view for other users' stories
  useEffect(() => {
    if (!isOpen || !currentStory || !activeUserId || isMyStory || !onRecordView) return;

    const viewKey = `${currentStory.id}_${activeUserId}`;
    if (recordedViewsRef.current.has(viewKey)) return;

    const alreadyRecorded = currentStory.viewers?.some((v) => v.userId === activeUserId);
    if (!alreadyRecorded) {
      recordedViewsRef.current.add(viewKey);
      onRecordView(currentStory.id, {
        userId: activeUserId,
        username: currentUser?.username || "user",
        name: currentUser?.name,
        userAvatar: currentUser?.profileImageUrl,
        viewedAt: new Date().toISOString(),
      });
    }
  }, [isOpen, currentIndex, currentStory, activeUserId, isMyStory, currentUser, onRecordView]);

  // Story progress timer
  const shouldPause = isPaused || isInputFocused || showViewersSheet || isSendingReply;

  useEffect(() => {
    if (!isOpen || !currentStory || shouldPause) return;

    const interval = 50; // update progress every 50ms
    const step = (interval / 5000) * 100; // 5000ms = 5s total duration

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, currentIndex, shouldPause, stories.length, onClose, currentStory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || isInputFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showViewersSheet) {
          setShowViewersSheet(false);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isInputFocused, showViewersSheet, currentIndex, stories.length]);

  if (!isOpen || !currentStory) return null;

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
      setReplyText("");
      setShowViewersSheet(false);
      setReplyFeedback(null);
    }
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
      setReplyText("");
      setShowViewersSheet(false);
      setReplyFeedback(null);
    } else {
      onClose();
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } catch {
      return "";
    }
  };

  const spawnFloatingParticle = (emoji: string) => {
    const newParticle: FloatingParticle = {
      id: Date.now() + Math.random(),
      emoji,
      left: Math.floor(Math.random() * 60) + 20, // 20% to 80% horizontal range
    };
    setFloatingParticles((prev) => [...prev, newParticle]);
    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 1500);
  };

  // Send Direct Message reply to the story author
  const sendStoryReplyOrReaction = async (text: string, isReactionEmoji = false) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingReply || !activeUserId) return;

    setIsSendingReply(true);

    // Build story preview payload
    const storyPreviewData = {
      storyId: currentStory.id,
      type: currentStory.type,
      mediaUrl: currentStory.mediaUrl,
      text: currentStory.text,
      background: currentStory.background,
      authorUsername: currentStory.username,
      authorAvatar: currentStory.userAvatar,
    };

    const formattedPayload = `[STORY_REPLY:${JSON.stringify(storyPreviewData)}] ${trimmed}`;

    try {
      // 1. Send direct message
      await api.post(`/messages/${currentStory.userId}`, {
        content: formattedPayload,
      });

      // 2. If it's a reaction emoji, record it
      if (isReactionEmoji && onAddReaction) {
        onAddReaction(currentStory.id, {
          userId: activeUserId,
          username: currentUser?.username || "user",
          userAvatar: currentUser?.profileImageUrl,
          emoji: trimmed,
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Trigger floating animation
      spawnFloatingParticle(isReactionEmoji ? trimmed : "❤️");

      // 4. Show success feedback
      setReplyFeedback(isReactionEmoji ? `Reacted ${trimmed}` : "Reply sent");
      setTimeout(() => setReplyFeedback(null), 2500);
      setReplyText("");
    } catch (err: any) {
      console.error("Failed to send story reply:", err);
      setReplyFeedback("Failed to send message");
      setTimeout(() => setReplyFeedback(null), 2500);
    } finally {
      setIsSendingReply(false);
      setIsInputFocused(false);
    }
  };

  const viewersList = currentStory.viewers || [];
  const reactionsList = currentStory.reactions || [];

  return createPortal(
    <div className="story-viewer-overlay" onClick={onClose}>
      {/* Navigation left button */}
      {currentIndex > 0 && (
        <button
          type="button"
          className="story-nav-btn prev"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          title="Previous story"
        >
          ‹
        </button>
      )}

      {/* Story Stage */}
      <div
        className="story-viewer-card"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => !isInputFocused && setIsPaused(true)}
        onMouseUp={() => !isInputFocused && setIsPaused(false)}
        onTouchStart={() => !isInputFocused && setIsPaused(true)}
        onTouchEnd={() => !isInputFocused && setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="story-progress-row">
          {stories.map((s, idx) => {
            let widthPercent = 0;
            if (idx < currentIndex) widthPercent = 100;
            else if (idx === currentIndex) widthPercent = progress;

            return (
              <div key={s.id} className="story-progress-bar">
                <div
                  className="story-progress-fill"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header */}
        <div className="story-viewer-header">
          <div
            className="story-viewer-author"
            onClick={() => {
              onClose();
              navigate(`/user/${currentStory.userId}`);
            }}
            title={`View @${currentStory.username}'s profile`}
          >
            <div className="story-author-avatar">
              {currentStory.userAvatar ? (
                <img
                  src={currentStory.userAvatar}
                  alt={currentStory.username}
                />
              ) : (
                (currentStory.username || "U")[0].toUpperCase()
              )}
            </div>
            <div className="story-author-info">
              <span className="story-author-name">{currentStory.username}</span>
              <span className="story-time-ago">
                {formatTimeAgo(currentStory.createdAt)}
              </span>
            </div>
          </div>

          <div className="story-viewer-actions">
            {isMyStory && onDeleteStory && (
              <button
                type="button"
                className="story-delete-btn"
                title="Delete your story"
                onClick={() => {
                  onDeleteStory(currentStory.id);
                  if (stories.length <= 1) {
                    onClose();
                  } else {
                    goToNext();
                  }
                }}
              >
                🗑️
              </button>
            )}
            <button
              type="button"
              className="story-viewer-close"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Story Content Area */}
        <div className="story-viewer-content">
          {currentStory.type === "image" && currentStory.mediaUrl ? (
            <div className="story-image-wrap">
              <img
                src={currentStory.mediaUrl}
                alt="Story media"
                className="story-viewer-img"
              />
              {currentStory.text && (
                <div className="story-viewer-caption">
                  {currentStory.text}
                </div>
              )}
            </div>
          ) : (
            <div
              className="story-viewer-text-card"
              style={{
                background:
                  currentStory.background ||
                  "linear-gradient(135deg, #667eea, #764ba2)",
              }}
            >
              <div className="story-text-body">{currentStory.text}</div>
            </div>
          )}

          {/* Tap navigation hotspots (Left / Right) */}
          <div
            className="story-tap-zone left"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          />
          <div
            className="story-tap-zone right"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          />

          {/* Floating animated reactions (❤️, 🔥, etc.) */}
          {floatingParticles.map((particle) => (
            <div
              key={particle.id}
              className="floating-reaction-particle"
              style={{ left: `${particle.left}%` }}
            >
              {particle.emoji}
            </div>
          ))}

          {/* Toast feedback pill */}
          {replyFeedback && (
            <div className="story-reply-feedback-pill">
              <span>{replyFeedback}</span>
            </div>
          )}
        </div>

        {/* ── Story Viewer Bottom Controls / Footer ── */}
        <div
          className="story-viewer-footer"
          onClick={(e) => e.stopPropagation()}
        >
          {isMyStory ? (
            /* ── Own Story Footer: "Seen by X" ── */
            <div className="story-owner-footer">
              <button
                type="button"
                className="story-viewers-toggle-btn"
                onClick={() => setShowViewersSheet(true)}
              >
                <div className="story-viewers-preview-stack">
                  {viewersList.slice(0, 3).map((v, i) => (
                    <div
                      key={v.userId}
                      className="story-stack-avatar"
                      style={{ zIndex: 3 - i }}
                    >
                      {v.userAvatar ? (
                        <img src={v.userAvatar} alt="" />
                      ) : (
                        (v.username || "U")[0].toUpperCase()
                      )}
                    </div>
                  ))}
                  {viewersList.length === 0 && (
                    <span className="story-eye-icon">👁️</span>
                  )}
                </div>
                <div className="story-viewers-count-text">
                  <span>
                    {viewersList.length === 0
                      ? "No views yet"
                      : `${viewersList.length} ${
                          viewersList.length === 1 ? "viewer" : "viewers"
                        }`}
                  </span>
                  <span className="story-viewers-sub">Tap to see who viewed</span>
                </div>
                <span className="story-viewers-chevron">▲</span>
              </button>
            </div>
          ) : (
            /* ── Other User's Story: React (Heart + Emojis) & Direct Message Reply ── */
            <div className="story-interact-footer">
              {/* Quick Reactions Bar */}
              <div className="story-quick-reactions-bar">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="story-quick-emoji-btn"
                    onClick={() => sendStoryReplyOrReaction(emoji, true)}
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply Input + Heart Action */}
              <div className="story-reply-input-row">
                <div className="story-reply-input-box">
                  <input
                    type="text"
                    className="story-reply-input"
                    placeholder={`Reply to @${currentStory.username}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendStoryReplyOrReaction(replyText, false);
                      }
                    }}
                  />

                  {replyText.trim().length > 0 && (
                    <button
                      type="button"
                      className="story-send-reply-btn"
                      disabled={isSendingReply}
                      onClick={() => sendStoryReplyOrReaction(replyText, false)}
                      title="Send message"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Big Heart Reaction Button */}
                <button
                  type="button"
                  className="story-heart-react-btn"
                  onClick={() => sendStoryReplyOrReaction("❤️", true)}
                  title="Send Heart"
                >
                  <span className="story-heart-icon">❤️</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Slide-up Story Viewers Sheet (for own story) ── */}
        {isMyStory && showViewersSheet && (
          <div
            className="story-viewers-sheet-overlay"
            onClick={() => setShowViewersSheet(false)}
          >
            <div
              className="story-viewers-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="story-viewers-sheet-header">
                <div className="story-sheet-drag-handle" />
                <div className="story-sheet-title-row">
                  <div className="story-sheet-title">
                    <span>👁️ Viewed by {viewersList.length}</span>
                  </div>
                  <button
                    type="button"
                    className="story-sheet-close"
                    onClick={() => setShowViewersSheet(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="story-viewers-list">
                {viewersList.length === 0 ? (
                  <div className="story-no-viewers">
                    <div className="story-no-viewers-icon">👁️</div>
                    <h4>No views yet</h4>
                    <p>
                      People who view your story within 24 hours will appear here.
                    </p>
                  </div>
                ) : (
                  viewersList.map((viewer) => {
                    const reaction = reactionsList.find(
                      (r) => r.userId === viewer.userId
                    );

                    return (
                      <div
                        key={viewer.userId}
                        className="story-viewer-row"
                        onClick={() => {
                          onClose();
                          navigate(`/user/${viewer.userId}`);
                        }}
                      >
                        <div className="story-viewer-avatar">
                          {viewer.userAvatar ? (
                            <img src={viewer.userAvatar} alt={viewer.username} />
                          ) : (
                            (viewer.username || "U")[0].toUpperCase()
                          )}
                        </div>

                        <div className="story-viewer-details">
                          <span className="story-viewer-username">
                            @{viewer.username}
                          </span>
                          <span className="story-viewer-sub">
                            {viewer.name && <span>{viewer.name} • </span>}
                            <span>{formatTimeAgo(viewer.viewedAt)}</span>
                          </span>
                        </div>

                        {reaction && (
                          <div
                            className="story-viewer-reaction-badge"
                            title={`Reacted ${reaction.emoji}`}
                          >
                            <span>{reaction.emoji}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation right button */}
      {currentIndex < stories.length - 1 && (
        <button
          type="button"
          className="story-nav-btn next"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          title="Next story"
        >
          ›
        </button>
      )}
    </div>,
    document.body
  );
}
