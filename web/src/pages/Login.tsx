import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("accessToken", response.data.accessToken);
      navigate("/");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />

      <section className="auth-layout">
        <div className="auth-brand-panel">
          <div className="brand-mark">SC</div>
          <span className="brand-kicker">WELCOME BACK</span>
          <h1>Connect with<br /><span>your people.</span></h1>
          <p>Share moments, discover people, and stay connected in one beautiful space.</p>

          <div className="auth-feature-list">
            <div><span>✦</span> Share your moments</div>
            <div><span>♡</span> Follow people you care about</div>
            <div><span>⌁</span> Chat privately with friends</div>
          </div>
        </div>

        <form className="auth-premium-card" onSubmit={login}>
          <div className="auth-card-heading">
            <div className="mobile-brand-mark">SC</div>
            <span className="auth-eyebrow">SOCIAL CONNECT</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your account.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>!</span>{error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="login-email">Email address</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">@</span>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">Password</label>
              <span className="auth-helper">Secure sign in</span>
            </div>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">⌁</span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            <span>{loading ? "Signing in..." : "Sign in"}</span>
            {!loading && <span className="auth-submit-arrow">→</span>}
          </button>

          <div className="auth-divider"><span>New to Social Connect?</span></div>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Create an account</Link>
          </p>

          <small className="auth-legal">
            By continuing, you agree to use Social Connect responsibly.
          </small>
        </form>
      </section>
    </main>
  );
}

export default Login;
