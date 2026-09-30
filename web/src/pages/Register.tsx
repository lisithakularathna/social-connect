import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import GoogleAuthButton from "../components/GoogleAuthButton";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        name,
        username,
        email,
        password,
      });

      localStorage.setItem("accessToken", response.data.accessToken);
      navigate("/");
    } catch {
      setError("Registration failed. Try a different username/email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={register}>
        <div className="logo-container">
          <img src="/vite.svg" alt="Social Connect" className="auth-logo" />
        </div>
        <h1>Social Connect</h1>
        <p className="auth-subtitle">Create a new account</p>

        {error && <div className="error">{error}</div>}

        <div className="input-group">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <GoogleAuthButton isLogin={false} />

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
