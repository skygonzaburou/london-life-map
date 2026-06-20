export default function LoginPage() {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>London Life App</h1>
        <p>Please sign in with your Microsoft account to continue.</p>

        <a href="/.auth/login/aad?post_login_redirect_uri=/">
          Sign in with Microsoft
        </a>
      </main>
    );
  }