import { useRef, useState, type ChangeEvent } from "react";
import "./StoriesBar.css";

export interface StoryItem {
  id: string;
  userId: number;
  username: string;
  userAvatar?: string;
  type: "image" | "text";
  mediaUrl?: string;
  text?: string;
  background?: string;
  createdAt: string;
}

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: StoryItem) => void;
  currentUser: {
    id: number;
    username?: string;
    profileImageUrl?: string;
  } | null;
}

const GRADIENT_PRESETS = [
  "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
  "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
  "linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)",
  "linear-gradient(135deg, #141e30 0%, #243b55 100%)",
  "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)",
];

export default function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
  currentUser,
}: CreateStoryModalProps) {
  const [mode, setMode] = useState<"image" | "text">("image");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [textContent, setTextContent] = useState("");
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be smaller than 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShare = () => {
    if (!currentUser) return;
    setIsSubmitting(true);

    const now = new Date().toISOString();
    const newStory: StoryItem = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: currentUser.id,
      username: currentUser.username || "You",
      userAvatar: currentUser.profileImageUrl,
      type: mode,
      createdAt: now,
      ...(mode === "image"
        ? { mediaUrl: imagePreview || "", text: caption.trim() }
        : { text: textContent.trim(), background: selectedGradient }),
    };

    onStoryCreated(newStory);
    setIsSubmitting(false);
    resetAndClose();
  };

  const resetAndClose = () => {
    setImagePreview(null);
    setCaption("");
    setTextContent("");
    setIsSubmitting(false);
    onClose();
  };

  const canShare =
    mode === "image"
      ? Boolean(imagePreview)
      : Boolean(textContent.trim().length > 0);

  return (
    <div className="story-modal-overlay" onClick={resetAndClose}>
      <div
        className="story-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="story-modal-header">
          <h3>Create Story</h3>
          <button
            type="button"
            className="story-modal-close"
            onClick={resetAndClose}
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="story-mode-tabs">
          <button
            type="button"
            className={`story-mode-tab ${mode === "image" ? "active" : ""}`}
            onClick={() => setMode("image")}
          >
            📷 Photo Story
          </button>
          <button
            type="button"
            className={`story-mode-tab ${mode === "text" ? "active" : ""}`}
            onClick={() => setMode("text")}
          >
            ✍️ Text Story
          </button>
        </div>

        {mode === "image" ? (
          <div className="story-image-composer">
            {imagePreview ? (
              <div className="story-preview-container">
                <img
                  src={imagePreview}
                  alt="Story preview"
                  className="story-image-preview"
                />
                <button
                  type="button"
                  className="story-change-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div
                className="story-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="story-dropzone-icon">📷</div>
                <h4>Choose a photo for your story</h4>
                <p>Click or drag image here (JPEG, PNG, WEBP)</p>
                <button type="button" className="story-upload-btn">
                  Select from device
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {imagePreview && (
              <input
                type="text"
                className="story-caption-input"
                placeholder="Add a caption... (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={120}
              />
            )}
          </div>
        ) : (
          <div className="story-text-composer">
            <div
              className="story-text-preview"
              style={{ background: selectedGradient }}
            >
              <textarea
                className="story-text-input"
                placeholder="Type your story here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                maxLength={240}
                autoFocus
              />
            </div>

            <div className="story-gradient-selector">
              <label>Choose Background:</label>
              <div className="story-gradient-options">
                {GRADIENT_PRESETS.map((grad, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`story-gradient-circle ${
                      selectedGradient === grad ? "active" : ""
                    }`}
                    style={{ background: grad }}
                    onClick={() => setSelectedGradient(grad)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="story-modal-footer">
          <div className="story-duration-notice">
            <span>⏱️</span> Visible for 24 hours
          </div>

          <div className="story-modal-actions">
            <button
              type="button"
              className="story-btn-cancel"
              onClick={resetAndClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="story-btn-submit"
              onClick={handleShare}
              disabled={!canShare || isSubmitting}
            >
              {isSubmitting ? "Sharing..." : "Share Story"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
