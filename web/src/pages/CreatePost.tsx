import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";
import "./CreatePost.css";

const BACKGROUND_OPTIONS = [
  { label: "Classic Gray", value: "#F3F4F6", isDark: false },
  { label: "Warm Cream", value: "#FFF3E0", isDark: false },
  { label: "Soft Rose", value: "#FFE4E6", isDark: false },
  { label: "Sky Blue", value: "#E0F2FE", isDark: false },
  { label: "Mint Green", value: "#DCFCE7", isDark: false },
  { label: "Lavender", value: "#EDE9FE", isDark: false },
  { label: "Peach", value: "#FFF7ED", isDark: false },
  { label: "Midnight Dark", value: "#111827", isDark: true },
  { label: "Sunset Glow", value: "linear-gradient(135deg, #ff7e5f, #feb47b)", isDark: true },
  { label: "Berry Cosmic", value: "linear-gradient(135deg, #d94d6a, #7c4d9e)", isDark: true },
  { label: "Ocean Breeze", value: "linear-gradient(135deg, #2193b0, #6dd5ed)", isDark: true },
  { label: "Emerald Aurora", value: "linear-gradient(135deg, #11998e, #38ef7d)", isDark: true },
];

const FONT_PRESETS = [
  { label: "Small", size: 18 },
  { label: "Regular", size: 22 },
  { label: "Large", size: 28 },
  { label: "Hero", size: 36 },
];

function CreatePost() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: "photo" or "text"
  const [postMode, setPostMode] = useState<"photo" | "text">("text");

  // Post Content
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Styling (Matching Mobile)
  const [backgroundColor, setBackgroundColor] = useState<string>("#F3F4F6");
  const [fontSize, setFontSize] = useState<number>(22);

  // Tagging (Matching Mobile)
  const [tagInput, setTagInput] = useState("");
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);

  // State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImageChange = (file: File | null) => {
    setImage(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setPostMode("photo");
    } else {
      setImagePreview("");
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^@/, "");
    if (clean && !taggedUsers.includes(clean)) {
      setTaggedUsers([...taggedUsers, clean]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (userToRemove: string) => {
    setTaggedUsers(taggedUsers.filter((u) => u !== userToRemove));
  };

  const currentBgOption = BACKGROUND_OPTIONS.find((bg) => bg.value === backgroundColor);
  const isDarkBg = currentBgOption ? currentBgOption.isDark : false;

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg("Please enter a post title");
      return;
    }

    const formData = new FormData();
    formData.append("title", cleanTitle);

    // Combine content and tagged usernames
    const tagSuffix =
      taggedUsers.length > 0 ? `\n\nTagged: ${taggedUsers.map((u) => `@${u}`).join(" ")}` : "";
    const finalContent = content.trim() + tagSuffix;
    if (finalContent) {
      formData.append("content", finalContent);
    }

    // Attach styling parameters
    formData.append("backgroundColor", backgroundColor);
    formData.append("fontSize", String(fontSize));

    // Optional image
    if (image && postMode === "photo") {
      formData.append("image", image);
    }

    try {
      setLoading(true);
      await api.post("/posts", formData);
      navigate("/");
    } catch (error: any) {
      console.error("Create post error:", error);
      setErrorMsg(error.response?.data?.message || "Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="create-page">
        <div className="create-page-header">
          <div>
            <h1>Create New Post</h1>
            <p>Share photos, custom colored thoughts, or stories with your community</p>
          </div>
        </div>

        <form className="create-card" onSubmit={createPost}>
          {/* Post Format Tabs */}
          <div className="create-type-tabs" role="tablist">
            <button
              type="button"
              className={`create-type-tab ${postMode === "text" ? "active" : ""}`}
              onClick={() => setPostMode("text")}
            >
              <span>✍️</span> Colored Text Post
            </button>
            <button
              type="button"
              className={`create-type-tab ${postMode === "photo" ? "active" : ""}`}
              onClick={() => {
                setPostMode("photo");
                if (!image) fileInputRef.current?.click();
              }}
            >
              <span>📷</span> Photo Post
            </button>
          </div>

          {errorMsg && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", fontSize: "14px", fontWeight: "600" }}>
              {errorMsg}
            </div>
          )}

          {/* Title Field */}
          <div className="create-field-group">
            <label htmlFor="create-post-title">Post Title *</label>
            <input
              id="create-post-title"
              className="create-input-title"
              placeholder={postMode === "text" ? "What's on your mind?..." : "Title of your post..."}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Caption / Content Textarea */}
          <div className="create-field-group">
            <label htmlFor="create-post-caption">Caption or Details (Optional)</label>
            <textarea
              id="create-post-caption"
              className="create-textarea-caption"
              placeholder="Write more thoughts, details, or stories..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* PHOTO POST SECTION */}
          {postMode === "photo" && (
            <div className="create-field-group">
              <label>Post Photo</label>

              {imagePreview ? (
                <div className="create-image-preview-card">
                  <img src={imagePreview} alt="Post preview" />
                  <div className="create-image-overlay-actions">
                    <button
                      type="button"
                      className="create-image-action-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="create-image-action-btn"
                      onClick={() => handleImageChange(null)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="create-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="create-upload-icon-circle">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect width="18" height="18" x="3" y="3" rx="4" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <strong>Click or Drag to Upload a Photo</strong>
                  <p>Supports JPG, PNG, WebP up to 10MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {/* TEXT POST STYLE CONTROLS (MATCHING MOBILE) */}
          {postMode === "text" && (
            <div className="create-text-style-section">
              <div className="create-section-subtitle">🎨 Live Text Post Preview</div>

              {/* LIVE POST PREVIEW CARD */}
              <div
                className="create-post-live-preview"
                style={{
                  background: backgroundColor,
                  color: isDarkBg ? "#ffffff" : "#111827",
                }}
              >
                <h2
                  className="create-live-preview-title"
                  style={{
                    fontSize: `${fontSize}px`,
                  }}
                >
                  {title.trim() || "Your colored post preview"}
                </h2>
                {content.trim() && (
                  <p className="create-live-preview-content">
                    {content.trim()}
                  </p>
                )}
              </div>

              {/* Background Color Palette Swatches */}
              <div className="create-field-group">
                <label>Select Background Color</label>
                <div className="create-swatches-grid">
                  {BACKGROUND_OPTIONS.map((bg) => {
                    const isSelected = backgroundColor === bg.value;
                    return (
                      <div
                        key={bg.value}
                        className={`create-color-swatch ${isSelected ? "active" : ""}`}
                        style={{ background: bg.value }}
                        onClick={() => setBackgroundColor(bg.value)}
                        title={bg.label}
                      >
                        {isSelected && (
                          <span
                            className="create-swatch-check"
                            style={{ color: bg.isDark ? "#ffffff" : "#111827" }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Slider and Presets */}
              <div className="create-field-group">
                <div className="create-font-control-row">
                  <label>Font Size</label>
                  <span className="create-font-size-badge">{fontSize}px</span>
                </div>

                <input
                  type="range"
                  className="create-font-slider"
                  min="16"
                  max="40"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />

                <div className="create-font-presets">
                  {FONT_PRESETS.map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      className={`create-font-preset-btn ${fontSize === preset.size ? "active" : ""}`}
                      onClick={() => setFontSize(preset.size)}
                    >
                      {preset.label} ({preset.size}px)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAG PEOPLE */}
          <div className="create-tag-section">
            <label style={{ fontSize: "13.5px", fontWeight: "700", color: "var(--text-primary)" }}>
              🏷️ Tag Friends
            </label>
            <div className="create-tag-input-row">
              <input
                className="create-tag-input"
                placeholder="Type username (e.g. alex)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button type="button" className="create-tag-btn" onClick={handleAddTag}>
                Add Tag
              </button>
            </div>

            {taggedUsers.length > 0 && (
              <div className="create-tag-chips">
                {taggedUsers.map((u) => (
                  <span key={u} className="create-tag-chip">
                    @{u}
                    <button type="button" onClick={() => handleRemoveTag(u)} aria-label="Remove tag">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit Post Button */}
          <button type="submit" className="create-submit-btn" disabled={loading}>
            {loading ? (
              <span>Publishing Post…</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>Share Post</span>
              </>
            )}
          </button>
        </form>
      </main>

      <BottomNav />
    </>
  );
}

export default CreatePost;
