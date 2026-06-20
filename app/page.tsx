"use client";

import { useEffect, useState } from "react";

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
    </main>
  );
}