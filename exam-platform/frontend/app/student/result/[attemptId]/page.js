"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { getAuth } from "../../../../lib/auth";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth?.user?.role !== "student") {
      router.push("/student/dashboard");
      return;
    }

    apiRequest(`/student/attempts/${params.attemptId}/result`, { token: auth.token })
      .then((data) => setResult(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.attemptId, router]);

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
            <p className="stu-muted">Loading result...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!result) {
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
          <p className="stu-alert stu-alert-error">{error || "Result not available"}</p>
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
          <Link className="stu-header-link" href="/student/dashboard">Dashboard</Link>
        </div>
      </header>

      <main className="stu-main">
        <div className="stu-card stu-panel-title">
          <h1 className="stu-title">Result: {result.examTitle}</h1>
          <p className="stu-muted">Submission reason: {result.submittedReason}</p>
        </div>

        <section className="stu-stats-grid">
          <article className="stu-card stu-stat-card">
            <span>Total Score</span>
            <strong>{result.score}</strong>
          </article>
          <article className="stu-card stu-stat-card">
            <span>Correct</span>
            <strong>{result.correctCount}</strong>
          </article>
          <article className="stu-card stu-stat-card">
            <span>Wrong</span>
            <strong>{result.wrongCount}</strong>
          </article>
          <article className="stu-card stu-stat-card">
            <span>Unattempted</span>
            <strong>{result.unattemptedCount}</strong>
          </article>
        </section>

        <section className="stu-card">
          <h3 className="stu-subtitle">Section-wise Performance</h3>
          <div className="stu-table-wrap">
            <table className="stu-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Total</th>
                  <th>Correct</th>
                  <th>Wrong</th>
                  <th>Unattempted</th>
                </tr>
              </thead>
              <tbody>
                {result.sectionStats.map((section) => (
                  <tr key={section.sectionId}>
                    <td>{section.sectionName}</td>
                    <td>{section.total}</td>
                    <td className="stu-cell-correct">{section.correct}</td>
                    <td className="stu-cell-wrong">{section.wrong}</td>
                    <td>{section.unattempted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="stu-actions-row">
            <Link className="stu-btn stu-btn-primary" href="/student/dashboard">
              Back to Dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
