import Link from "next/link";

export default function HomePage() {
  return (
    <div className="home-shell">

      {/* HEADER */}
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-header-brand">
            <div className="home-logo-box" aria-hidden="true" />
            <div>
              <div className="home-site-name">Sewa Sakshyam</div>
              <div className="home-site-tag">Online Examination Portal</div>
            </div>
          </div>
          <nav className="home-header-nav">
            <Link href="/admin/login" className="home-nav-link">Admin Login</Link>
          </nav>
        </div>
      </header>

      {/* NOTICE BAR */}
      <div className="home-notice">
        Candidates are advised to keep their registered email ID ready for OTP verification before starting an exam.
      </div>

      {/* MAIN */}
      <main className="home-main">

        {/* Welcome panel */}
        <section className="home-welcome-panel">
          <h1 className="home-welcome-title">Welcome to Sewa Sakshyam</h1>
          <p className="home-welcome-desc">
            A secure, scheduled online examination platform for JEE &amp; NEET aspirants.
            Tests are OTP-verified, auto-timed, and results are available immediately after submission.
          </p>
        </section>

        {/* Portal cards */}
        <section className="home-portals">
          <div className="home-portal-card">
            <div className="home-portal-header home-portal-header-student">Candidate Portal</div>
            <div className="home-portal-body">
              <p>Browse available examinations, verify your identity with an OTP, and begin your test. No account or password required.</p>
              <Link className="home-portal-btn home-portal-btn-primary" href="/student/dashboard">
                Go to Candidate Portal
              </Link>
            </div>
          </div>

          <div className="home-portal-card">
            <div className="home-portal-header home-portal-header-admin">Administrator Portal</div>
            <div className="home-portal-body">
              <p>Create and schedule examinations, manage sections and questions, publish tests, and view detailed results.</p>
              <Link className="home-portal-btn home-portal-btn-outline" href="/admin/login">
                Admin Login
              </Link>
            </div>
          </div>
        </section>

        {/* Info table */}
        <section className="home-info-section">
          <h2 className="home-info-heading">Platform Features</h2>
          <table className="home-info-table">
            <tbody>
              <tr><td>Exam Format</td><td>Multiple choice, section-wise (Physics, Chemistry, etc.)</td></tr>
              <tr><td>Marking Scheme</td><td>Configurable correct / wrong / unattempted marks per exam</td></tr>
              <tr><td>Identity Verification</td><td>Email OTP — no account creation needed</td></tr>
              <tr><td>Scheduling</td><td>Exams open at a set date and time; countdown shown to candidate</td></tr>
              <tr><td>Anti-cheating</td><td>Auto-submit on tab switch or time expiry</td></tr>
              <tr><td>Results</td><td>Instant section-wise breakdown and rank table after submission</td></tr>
            </tbody>
          </table>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="home-footer">
        {new Date().getFullYear()} Sewa Sakshyam. All rights reserved.
      </footer>

    </div>
  );
}
