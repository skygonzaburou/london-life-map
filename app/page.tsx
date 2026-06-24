"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const AzureMap = dynamic(() => import("@/src/components/AzureMap"), {
  ssr: false,
});

type AppTab = "rent-map" | "restaurants";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("rent-map");

  return (
    <main className="app-page">
      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1 className="app-title">London Life App</h1>
            <p className="app-subtitle">
              Tools to support life and area selection in London.
            </p>
          </div>

          <a className="logout-button" href="/logout">
            Log out
          </a>
        </header>

        <nav className="tab-bar" aria-label="Application tabs">
          <button
            type="button"
            className={`tab-button ${activeTab === "rent-map" ? "active" : ""}`}
            onClick={() => setActiveTab("rent-map")}
          >
            Rent Map
          </button>

          <button
            type="button"
            className="tab-button"
            disabled
            title="Coming soon"
          >
            Recommended Restaurants
          </button>
        </nav>

        {activeTab === "rent-map" && <AzureMap />}
      </div>
    </main>
  );
}