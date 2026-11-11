import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./modern-ui.css";
import App from "./App.tsx";
import { applySavedTheme } from "./utils/prefs";

// Apply the theme before React renders so pages without the Navbar
// (login/register) also respect dark mode and there is no light flash.
applySavedTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
