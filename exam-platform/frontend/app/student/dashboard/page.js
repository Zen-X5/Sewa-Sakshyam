"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

const formatDateTime = (value) => {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleString();
};

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exams, setExams] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    apiRequest("/student/exams", { skipAuth: true })
      .then((data) => setExams(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stu-shell">
        <header className="stu-header">
          <div className="stu-header-inner">
            <div>
              <div className="stu-brand">Sewa Sakshyam</div>
              <div className="stu-brand-sub">Candidate Examination Portal</div>
            </div>
          </div>
        </header>
        <main className="stu-main">
          <div className="stu-card">
            <p className="stu-muted">Loading examinations...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="stu-shell">
      <header className="stu-header">
        <div className="stu-header-inner">
          <div>
            <div className="stu-brand">Sewa Sakshyam</div>
            <div className="stu-brand-sub">Candidate Examination Portal</div>
          </div>
          <Link className="stu-header-link" href="/">
            Home
          </Link>
        </div>
      </header>

      <main className="stu-main">
        <div className="stu-card stu-panel-title">
          <h1 className="stu-title">Available Examinations</h1>
          <p className="stu-muted">No login required. Verify your email via OTP and start when the countdown reaches zero.</p>
        </div>

        {error ? <p className="stu-alert stu-alert-error">{error}</p> : null}

        {!exams.length ? (
          <div className="stu-card">
            <p className="stu-muted">No exams are available right now. Please check again later.</p>
          </div>
        ) : null}

        <section className="stu-exam-grid">
          {exams.map((exam) => (
            <article className="stu-card stu-exam-card" key={exam._id}>
              <h2 className="stu-exam-title">{exam.title}</h2>

              <div className="stu-meta-list">
                <div className="stu-meta-item"><span>Scheduled</span><strong>{formatDateTime(exam.scheduledAt)}</strong></div>
                <div className="stu-meta-item"><span>Duration</span><strong>{exam.duration} min</strong></div>
                <div className="stu-meta-item"><span>Questions</span><strong>{exam.questionCount}</strong></div>
                <div className="stu-meta-item"><span>Sections</span><strong>{exam.sectionCount}</strong></div>
                <div className="stu-meta-item"><span>Marking</span><strong>+{exam.markingScheme.correct} / {exam.markingScheme.wrong}</strong></div>
              </div>

              {exam.scheduledAt && now > new Date(exam.scheduledAt).getTime() ? (
                <button className="stu-btn stu-btn-primary" disabled>
                  Exam Has Started
                </button>
              ) : (
                <Link className="stu-btn stu-btn-primary" href={`/student/start/${exam._id}`}>
                  Start Exam
                </Link>
              )}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
