import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", { email, username, name, password });
      navigate("/login");
    } catch {
      setError("Registration failed. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell auth-shell-register">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />

      <section className="auth-layout">
        <div className="auth-brand-panel">
          <div className="brand-mark">SC</div>
          <span className="brand-kicker">JOIN THE COMMUNITY</span>
          <h1>Your world.<br /><span>Your connections.</span></h1>
          <p>Create your profile and start sharing with the people who matter to you.</p>

          <div className="auth-feature-list">
            <div><span>✦</span> Build your profile</div>
            <div><span>◉</span> Discover new people</div>
            <div><span>♡</span> Share and connect</div>
          </div>
        </div>

        <form className="auth-premium-card" onSubmit={register}>
          <div className="auth-card-heading">
            <div className="mobile-brand-mark">SC</div>
            <span className="auth-eyebrow">SOCIAL CONNECT</span>
            <h2>Create your account</h2>
            <p>It only takes a minute to get started.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>!</span>{error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="register-name">Full name</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✦</span>
              <input
                id="register-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-username">Username</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">@</span>
              <input
                id="register-username"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email address</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">@</span>
              <input
                id="register-email"
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
            <label htmlFor="register-password">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">⌁</span>
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            <span>{loading ? "Creating account..." : "Create account"}</span>
            {!loading && <span className="auth-submit-arrow">→</span>}
          </button>

          <div className="auth-divider"><span>Already a member?</span></div>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>

          <small className="auth-legal">
            Your account details are used only to provide the Social Connect experience.
          </small>
        </form>
      </section>
    </main>
  );
}

export default Register;
