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
        <div className="auth-brand-mark" aria-hidden="true">S</div>
        <p className="auth-kicker">Welcome back</p>
        <h1>Sign in to Social Connect</h1>
        <p className="auth-subtitle">Keep up with the people and ideas that matter to you.</p>

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
