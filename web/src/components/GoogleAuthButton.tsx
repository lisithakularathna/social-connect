import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

declare global {
  interface Window {
    google: any;
  }
}

export default function GoogleAuthButton({ isLogin = true }: { isLogin?: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.google) return;

    window.google.accounts.id.initialize({
      client_id: "991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com",
      callback: async (response: any) => {
        try {
          const res = await api.post("/auth/google", {
            idToken: response.credential,
          });
          localStorage.setItem("accessToken", res.data.accessToken);
          navigate("/");
        } catch (error) {
          console.error("Google Sign-In failed", error);
          alert("Google Sign-In failed. Please try again.");
        }
      },
    });

    window.google.accounts.id.renderButton(
      document.getElementById("google-signin-button"),
      {
        theme: "outline",
        size: "large",
        width: "100%",
        shape: "rectangular",
        text: isLogin ? "signin_with" : "signup_with",
      }
    );
  }, [navigate, isLogin]);

  return <div id="google-signin-button" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}></div>;
}
