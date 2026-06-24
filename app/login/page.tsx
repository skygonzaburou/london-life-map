export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">London Life App</h1>

        <p className="login-description">
          Sign in to access London living support tools.
        </p>

        <a
          className="primary-button"
          href="/.auth/login/aad?post_login_redirect_uri=/"
        >
          Sign in with Microsoft
        </a>
      </section>
    </main>
  );
}