import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import GoogleAuthButton from "../components/GoogleAuthButton";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("accessToken", response.data.accessToken);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={login}>
        <div className="logo-container">
          <img src="/vite.svg" alt="Social Connect" className="auth-logo" />
        </div>
        <h1>Social Connect</h1>
        <p className="auth-subtitle">Sign in to continue</p>

        {error && <div className="error">{error}</div>}

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
          />
        </div>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <GoogleAuthButton isLogin={true} />

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register" className="auth-link">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
