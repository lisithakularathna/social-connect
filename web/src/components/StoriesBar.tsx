import { useEffect, useRef, useState } from "react";
import CreateStoryModal, { type StoryItem } from "./CreateStoryModal";
import StoryViewerModal from "./StoryViewerModal";
import "./StoriesBar.css";

interface PostAuthor {
  id?: number;
  username?: string;
  name?: string;
  profileImageUrl?: string;
}

interface PostLike {
  id: number;
  title: string;
  content?: string;
  imageUrl?: string;
  authorId: number;
  author?: PostAuthor;
  createdAt?: string;
}

interface StoriesBarProps {
  posts: PostLike[];
  currentUser: {
    id: number;
    username?: string;
    profileImageUrl?: string;
  } | null;
}

const LOCAL_STORIES_STORAGE_KEY = "sc_stories_v1";

export default function StoriesBar({ posts, currentUser }: StoriesBarProps) {
  const [localStories, setLocalStories] = useState<StoryItem[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load and filter valid 24h stories
  const loadStories = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORIES_STORAGE_KEY);
      if (!raw) return;
      const list: StoryItem[] = JSON.parse(raw);
      const now = Date.now();
      const valid = list.filter(
        (s) => now - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000
      );
      if (valid.length !== list.length) {
        localStorage.setItem(LOCAL_STORIES_STORAGE_KEY, JSON.stringify(valid));
      }
      setLocalStories(valid);
    } catch {
      setLocalStories([]);
    }
  };

  useEffect(() => {
    loadStories();
  }, []);

  const handleStoryCreated = (story: StoryItem) => {
    const updated = [story, ...localStories];
    localStorage.setItem(LOCAL_STORIES_STORAGE_KEY, JSON.stringify(updated));
    setLocalStories(updated);
  };

  const handleDeleteStory = (storyId: string) => {
    const updated = localStories.filter((s) => s.id !== storyId);
    localStorage.setItem(LOCAL_STORIES_STORAGE_KEY, JSON.stringify(updated));
    setLocalStories(updated);
  };

  // Build combined stories list for viewing
  const myStories = currentUser
    ? localStories.filter((s) => s.userId === currentUser.id)
    : [];

  // Generate mock feed stories from recent posts so there's always lively stories in the strip
  const feedStories: StoryItem[] = [];
  const seenUserIds = new Set<number>();

  if (currentUser) {
    seenUserIds.add(currentUser.id);
  }

  for (const post of posts) {
    if (post.author && post.author.id && !seenUserIds.has(post.author.id)) {
      seenUserIds.add(post.author.id);

      feedStories.push({
        id: `feed_story_${post.id}`,
        userId: post.author.id,
        username: post.author.username || post.author.name || "User",
        userAvatar: post.author.profileImageUrl,
        type: post.imageUrl ? "image" : "text",
        mediaUrl: post.imageUrl,
        text: post.content || post.title,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        createdAt: post.createdAt || new Date().toISOString(),
      });

      if (feedStories.length >= 10) break;
    }
  }

  // All viewable stories
  const allViewableStories = [...myStories, ...feedStories];

  const openViewerForStory = (storyId: string) => {
    const idx = allViewableStories.findIndex((s) => s.id === storyId);
    if (idx !== -1) {
      setViewerStartIndex(idx);
      setIsViewerOpen(true);
    }
  };

  const hasMyStory = myStories.length > 0;
  const latestMyStory = hasMyStory ? myStories[0] : null;

  return (
    <section className="stories-bar-container" aria-label="Stories">
      <div className="stories-bar-scroll" ref={scrollContainerRef}>
        {/* ── Your Story (Item #1) ── */}
        <div className="story-item-wrapper">
          <div
            className={`story-avatar-ring ${hasMyStory ? "active-ring" : "no-story"}`}
            onClick={() => {
              if (hasMyStory) {
                openViewerForStory(latestMyStory!.id);
              } else {
                setIsCreateOpen(true);
              }
            }}
          >
            <div className="story-avatar-inner">
              {currentUser?.profileImageUrl ? (
                <img
                  src={currentUser.profileImageUrl}
                  alt="Your story"
                  className="story-avatar-img"
                />
              ) : (
                <div className="story-avatar-placeholder">
                  {(currentUser?.username || "U")[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Plus badge to add new story */}
            <button
              type="button"
              className="story-add-badge"
              title="Add to story"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreateOpen(true);
              }}
            >
              +
            </button>
          </div>
          <span className="story-item-label">
            {hasMyStory ? "Your story" : "Add story"}
          </span>
        </div>

        {/* ── Other Users' Stories ── */}
        {feedStories.map((story) => (
          <div
            key={story.id}
            className="story-item-wrapper"
            onClick={() => openViewerForStory(story.id)}
          >
            <div className="story-avatar-ring active-ring">
              <div className="story-avatar-inner">
                {story.userAvatar ? (
                  <img
                    src={story.userAvatar}
                    alt={story.username}
                    className="story-avatar-img"
                  />
                ) : (
                  <div className="story-avatar-placeholder">
                    {story.username[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="story-item-label" title={story.username}>
              {story.username}
            </span>
          </div>
        ))}
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onStoryCreated={handleStoryCreated}
        currentUser={currentUser}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        stories={allViewableStories}
        initialIndex={viewerStartIndex}
        currentUserId={currentUser?.id}
        onDeleteStory={handleDeleteStory}
      />
    </section>
  );
}
