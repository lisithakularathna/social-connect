import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import api from "../api/api";

function CreatePost() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!image) {
      alert("Please select an image");
      return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("content", content);
    formData.append("image", image);

    try {
      setLoading(true);

      await api.post("/posts", formData);

      navigate("/");
    } catch (error) {
      console.error(error);
      alert("Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="create-page">
        <form
          className="create-card"
          onSubmit={createPost}
        >
          <h1>Create Post</h1>

          <input
            placeholder="Post title"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            required
          />

          <textarea
            placeholder="Write something..."
            value={content}
            onChange={(e) =>
              setContent(e.target.value)
            }
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setImage(
                e.target.files?.[0] || null,
              )
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Post"}
          </button>
        </form>
      </main>
      
      <BottomNav />
    </>
  );
}

export default CreatePost;
