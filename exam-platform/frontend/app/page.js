import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <div className="card">
        <h1 className="title">Online Examination Platform</h1>
        <p className="muted">
          JEE / NEET style mock test platform with one-question flow, timer, auto-save, and anti-cheating auto submit.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 className="title">Admin</h2>
          <p className="muted">Create exams, sections, questions, publish tests, and monitor attempts.</p>
          <Link className="button" href="/admin/login">
            Admin Login
          </Link>
        </div>

        <div className="card">
          <h2 className="title">Student</h2>
          <p className="muted">Enter name, verify email with OTP, add institute name, and start exam.</p>
          <Link className="button" href="/student/dashboard">
            Student Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
