import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker via vite-plugin-pwa for auto-update
const updateSW = registerSW({
  onRegisteredSW(swScriptUrl, registration) {
    console.log("[SW] Service worker registered:", swScriptUrl);
  },
  onRegisterError(error) {
    console.error("[SW] Service worker registration failed:", error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
