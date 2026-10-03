import { useEffect, useState } from "react";
import type { StoryItem } from "./CreateStoryModal";
import "./StoriesBar.css";

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: StoryItem[];
  initialIndex?: number;
  currentUserId?: number | null;
  onDeleteStory?: (storyId: string) => void;
}

export default function StoryViewerModal({
  isOpen,
  onClose,
  stories,
  initialIndex = 0,
  currentUserId,
  onDeleteStory,
}: StoryViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, isOpen]);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!isOpen || !currentStory || isPaused) return;

    const interval = 50; // update progress every 50ms
    const step = (interval / 5000) * 100; // 5000ms = 5s total duration

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story or close
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
  }, [isOpen, currentIndex, isPaused, stories.length, onClose, currentStory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, stories.length]);

  if (!isOpen || !currentStory) return null;

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const isMyStory = currentUserId === currentStory.userId;

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } catch {
      return "";
    }
  };

  return (
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
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
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
          <div className="story-viewer-author">
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
                background: currentStory.background || "linear-gradient(135deg, #667eea, #764ba2)",
              }}
            >
              <div className="story-text-body">{currentStory.text}</div>
            </div>
          )}

          {/* Tap navigation hotspots */}
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
        </div>
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
    </div>
  );
}
