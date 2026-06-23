"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AzureMap = dynamic(() => import("../src/components/AzureMap"), {
  ssr: false,
});

type ClientPrincipal = {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
};

type AuthMeResponse = {
  clientPrincipal: ClientPrincipal | null;
};

export default function Home() {
  const [user, setUser] = useState<ClientPrincipal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/.auth/me");
        const data: AuthMeResponse = await response.json();
        setUser(data.clientPrincipal);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  if (isLoading) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>London Life App</h1>

        {user ? (
          <>
            <p>You are signed in.</p>

            <p>
              <strong>User:</strong> {user.userDetails}
            </p>

            <p>
              <strong>Provider:</strong> {user.identityProvider}
            </p>

            <p>
              <strong>Roles:</strong> {user.userRoles.join(", ")}
            </p>

            <a href="/logout">Logout</a>
          </>
        ) : (
          <>
            <p>You are not signed in.</p>
            <a href="/login">Login</a>
          </>
        )}
      </header>

      {user && (
        <section>
          <h2>London borough map</h2>
          <AzureMap />

          <p style={{ fontSize: "0.8rem", marginTop: "0.75rem" }}>
            Source: Office for National Statistics licensed under the Open
            Government Licence v3.0. Contains OS data © Crown copyright and
            database right 2025.
          </p>
        </section>
      )}
    </main>
  );
}