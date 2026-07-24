import "./browser-buffer";

import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";
import { createRoot } from "react-dom/client";

import { AdminApp } from "./AdminApp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const privyAppId = (import.meta.env.VITE_PRIVY_APP_ID ?? "").trim();

createRoot(rootElement).render(
  <React.StrictMode>
    {privyAppId ? (
      <PrivyProvider
        appId={privyAppId}
        config={{
          appearance: {
            accentColor: "#28d886",
            theme: "dark",
          },
          loginMethods: ["email"],
        }}
      >
        <AdminApp />
      </PrivyProvider>
    ) : (
      <main className="access-shell">
        <section className="access-card access-card-centered">
          <p className="eyebrow">Configuration required</p>
          <h1>Admin sign-in is not configured</h1>
          <p>Add VITE_PRIVY_APP_ID to the admin deployment environment.</p>
        </section>
      </main>
    )}
  </React.StrictMode>,
);
