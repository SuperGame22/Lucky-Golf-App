import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { missingConfig } from "./lib/config";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const missing = missingConfig(import.meta.env);

if (missing.length > 0) {
  // A build without its settings used to show a blank page; say what is wrong instead.
  root.render(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#060d07", color: "#e8f0e8", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Lucky Golf is missing a setting</h1>
        <p style={{ opacity: 0.8, fontSize: 14 }}>This version was built without: {missing.join(", ")}. Add it in the hosting settings and redeploy.</p>
      </div>
    </div>,
  );
} else {
  // Loaded only now, so the app never starts (and never fails) without its settings.
  import("./App.tsx").then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}

// Offline app shell. Skipped in dev and inside iframes, where a service worker would
// serve stale builds while you are iterating.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
if (import.meta.env.PROD && "serviceWorker" in navigator && !isInIframe) {
  registerSW({ immediate: true });
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => undefined);
}
