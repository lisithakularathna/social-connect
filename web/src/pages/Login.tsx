import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api/api";
import GoogleAuthButton from "../components/GoogleAuthButton";
import PasswordInput from "../components/PasswordInput";
import { setSessionToken } from "../utils/session";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Set when the account has two-factor authentication on.
  const [challenge, setChallenge] = useState<string | null>(
    () => (location.state as { challengeToken?: string } | null)?.challengeToken ?? null
  );
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in? Skip the form.
  if (localStorage.getItem("accessToken")) {
    return <Navigate to="/" replace />;
  }

  const finish = (token: string) => {
    setSessionToken(token);
    navigate("/", { replace: true });
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      if (response.data?.twoFactorRequired) {
        setChallenge(response.data.challengeToken);
        setCode("");
        return;
      }
      finish(response.data.accessToken);
    } catch (err) {
      setError(getErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !challenge) return;
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/2fa/verify", {
        challengeToken: challenge,
        code: code.trim(),
      });
      finish(response.data.accessToken);
    } catch (err) {
      const message = getErrorMessage(err, "Incorrect code. Try again.");
      setError(message);
      // An expired challenge means starting over.
      if (/expired|log in again/i.test(message)) setChallenge(null);
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={verify}>
          <div className="auth-brand-mark" aria-hidden="true">🔐</div>
          <p className="auth-kicker">Two-factor authentication</p>
          <h1>Enter your code</h1>
          <p className="auth-subtitle">
            {useRecovery
              ? "Type one of the recovery codes you saved when you turned on 2FA."
              : "Open your authenticator app and enter the 6-digit code for Social Connect."}
          </p>

          {error && <div className="error" role="alert">{error}</div>}

          <div className="input-group">
            <input
              className={useRecovery ? "" : "sc-otp-input"}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              placeholder={useRecovery ? "XXXXX-XXXXX" : "123456"}
              value={code}
              onChange={(e) =>
                setCode(
                  useRecovery
                    ? e.target.value.toUpperCase().slice(0, 11)
                    : e.target.value.replace(/\D/g, "").slice(0, 6)
                )
              }
              aria-label={useRecovery ? "Recovery code" : "Authentication code"}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading || (useRecovery ? code.replace(/[^A-Z0-9]/g, "").length !== 10 : code.length !== 6)}
          >
            {loading ? <span className="sc-btn-spinner" aria-label="Verifying" /> : "Verify"}
          </button>

          <button
            type="button"
            className="sc-link-btn"
            style={{ alignSelf: "center" }}
            onClick={() => {
              setUseRecovery((v) => !v);
              setCode("");
              setError("");
            }}
          >
            {useRecovery ? "Use an authenticator code instead" : "Lost your phone? Use a recovery code"}
          </button>

          <p className="auth-footer">
            <button
              type="button"
              className="sc-link-btn"
              onClick={() => {
                setChallenge(null);
                setCode("");
                setError("");
              }}
            >
              ← Back to sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={login}>
        <div className="auth-brand-mark" aria-hidden="true">S</div>
        <p className="auth-kicker">Welcome back</p>
        <h1>Sign in to Social Connect</h1>
        <p className="auth-subtitle">Keep up with the people and ideas that matter to you.</p>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="input-group">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-label="Email address"
            autoFocus
            required
          />
        </div>

        <div className="input-group">
          <PasswordInput value={password} onChange={setPassword} />
        </div>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? <span className="sc-btn-spinner" aria-label="Signing in" /> : "Log in"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <GoogleAuthButton isLogin={true} onError={setError} onTwoFactor={setChallenge} />

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
