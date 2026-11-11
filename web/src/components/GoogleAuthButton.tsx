import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api/api";
import { setSessionToken } from "../utils/session";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  "991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com";

interface Props {
  isLogin?: boolean;
  onError?: (message: string) => void;
  /** Called with a challenge token when the account has 2FA on. */
  onTwoFactor?: (challengeToken: string) => void;
}

export default function GoogleAuthButton({ isLogin = true, onError, onTwoFactor }: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    // The GSI script loads with `async`, so it may not be ready on first
    // render. Wait for it (up to ~8s) instead of silently rendering nothing.
    const tryRender = () => {
      if (cancelled) return;
      const google = window.google;
      if (!google || !containerRef.current) {
        if (++attempts > 40) {
          setUnavailable(true);
          return;
        }
        timer = window.setTimeout(tryRender, 200);
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const res = await api.post("/auth/google", {
              idToken: response.credential,
            });
            if (res.data?.twoFactorRequired) {
              if (onTwoFactor) onTwoFactor(res.data.challengeToken);
              else navigate("/login", { state: { challengeToken: res.data.challengeToken } });
              return;
            }
            setSessionToken(res.data.accessToken);
            navigate("/", { replace: true });
          } catch (error) {
            console.error("Google Sign-In failed", error);
            onError?.(getErrorMessage(error, "Google Sign-In failed. Please try again."));
          }
        },
      });

      containerRef.current.innerHTML = "";
      google.accounts.id.renderButton(containerRef.current, {
        theme: document.body.classList.contains("dark-mode") ? "filled_black" : "outline",
        size: "large",
        width: Math.min(containerRef.current.offsetWidth || 360, 400),
        shape: "pill",
        text: isLogin ? "signin_with" : "signup_with",
      });
    };

    let timer = window.setTimeout(tryRender, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [navigate, isLogin, onError, onTwoFactor]);

  if (unavailable) {
    return (
      <p className="sc-google-unavailable">
        Google sign-in is unavailable right now. Use your email instead.
      </p>
    );
  }

  return <div ref={containerRef} className="sc-google-btn" />;
}
