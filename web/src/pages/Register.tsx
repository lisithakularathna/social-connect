import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api/api";
import GoogleAuthButton from "../components/GoogleAuthButton";
import PasswordInput from "../components/PasswordInput";
import { setSessionToken } from "../utils/session";

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  return { score, label: labels[score] };
}

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (localStorage.getItem("accessToken")) {
    return <Navigate to="/" replace />;
  }

  const usernameInvalid = username.length > 0 && !USERNAME_RE.test(username);
  const strength = passwordStrength(password);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3-30 characters: letters, numbers, "_" or "."');
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });

      if (response.data?.accessToken) {
        setSessionToken(response.data.accessToken);
        navigate("/", { replace: true });
      } else {
        // Older backends don't return a token on signup — sign in explicitly.
        const login = await api.post("/auth/login", { email: email.trim(), password });
        setSessionToken(login.data.accessToken);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Try a different username/email."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={register}>
        <div className="auth-brand-mark" aria-hidden="true">S</div>
        <p className="auth-kicker">Join the conversation</p>
        <h1>Create your account</h1>
        <p className="auth-subtitle">A thoughtful space for sharing, discovering, and connecting.</p>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="input-group">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            aria-label="Full name"
            maxLength={60}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            aria-label="Username"
            aria-invalid={usernameInvalid}
            maxLength={30}
            required
          />
          {usernameInvalid && (
            <small className="sc-field-hint is-error">
              3-30 characters: letters, numbers, "_" or "."
            </small>
          )}
        </div>

        <div className="input-group">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-label="Email address"
            required
          />
        </div>

        <div className="input-group">
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={6}
          />
          {password && (
            <div className="sc-strength" data-score={strength.score}>
              <div className="sc-strength-bar">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={i <= strength.score ? "on" : ""} />
                ))}
              </div>
              <small>{strength.label}</small>
            </div>
          )}
        </div>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? <span className="sc-btn-spinner" aria-label="Creating account" /> : "Sign up"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <GoogleAuthButton isLogin={false} onError={setError} />

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
