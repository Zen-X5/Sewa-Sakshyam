"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { clearAuth, getAuth } from "../../../../lib/auth";

export default function AdminExamReportPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.examId;

  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resultsPayload, setResultsPayload] = useState(null);
  const [attempts, setAttempts] = useState([]);

  const token = useMemo(() => auth?.token, [auth]);
  const scheduledAtLabel = resultsPayload?.exam?.scheduledAt
    ? new Date(resultsPayload.exam.scheduledAt).toLocaleString()
    : "-";

  const loadReport = async (currentToken, currentExamId) => {
    const [resultsResponse, attemptsResponse] = await Promise.all([
      apiRequest(`/admin/exams/${currentExamId}/results`, { token: currentToken }),
      apiRequest(`/admin/exams/${currentExamId}/attempts`, { token: currentToken }),
    ]);

    setResultsPayload(resultsResponse);
    setAttempts(attemptsResponse);
  };

  useEffect(() => {
    if (!examId) {
      return;
    }

    const localAuth = getAuth();
    if (!localAuth || localAuth?.user?.role !== "admin") {
      router.push("/admin/login");
      return;
    }

    setAuth(localAuth);
    setError("");

    loadReport(localAuth.token, examId)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [examId, router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/admin/login");
  };

  const handleRefresh = async () => {
    if (!token || !examId) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await loadReport(token, examId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="adm-shell">
        <div className="adm-loading">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="adm-shell">

      {/* ── TOP NAV ── */}
      <header className="adm-nav">
        <span className="adm-nav-brand">Sewa Sakshyam</span>
        <div className="adm-nav-right">
          <span className="adm-nav-role">Admin Panel</span>
          <button className="adm-btn adm-btn-ghost" onClick={() => router.push("/admin/dashboard")} type="button">
            ← Dashboard
          </button>
          <button className="adm-btn adm-btn-ghost" onClick={handleLogout} type="button">Logout</button>
        </div>
      </header>

      <main className="adm-main">

        {/* ── PAGE TITLE ── */}
        <div className="adm-page-title">
          <div>
            <h1>Exam Report</h1>
            <p>{resultsPayload?.exam?.title || ""}</p>
          </div>
          <button className="adm-btn adm-btn-outline" onClick={handleRefresh} type="button">Refresh</button>
        </div>

        {error ? <div className="adm-alert adm-alert-error">{error}</div> : null}

        {/* ── EXAM SUMMARY ── */}
        <section className="adm-card">
          <div className="adm-card-header">Exam Summary</div>
          <div className="adm-card-body adm-summary-chips">
            <div className="adm-summary-item">
              <span className="adm-summary-label">Title</span>
              <span className="adm-summary-value">{resultsPayload?.exam?.title || "—"}</span>
            </div>
            <div className="adm-summary-item">
              <span className="adm-summary-label">Scheduled</span>
              <span className="adm-summary-value">{scheduledAtLabel}</span>
            </div>
            <div className="adm-summary-item">
              <span className="adm-summary-label">Total Students</span>
              <span className="adm-summary-value">{resultsPayload?.results?.length || 0}</span>
            </div>
            <div className="adm-summary-item">
              <span className="adm-summary-label">Sections</span>
              <span className="adm-summary-value">{resultsPayload?.sections?.length || 0}</span>
            </div>
          </div>
        </section>

        {/* ── RESULTS TABLE ── */}
        <section className="adm-card">
          <div className="adm-card-header">Result Summary <span className="adm-card-header-note">sorted by total marks</span></div>
          <div className="adm-card-body adm-table-wrap">
            {resultsPayload?.results?.length ? (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    {(resultsPayload.sections || []).map((s) => <th key={s.sectionId}>{s.sectionName}</th>)}
                    <th>Total</th>
                    <th>Correct</th>
                    <th>Wrong</th>
                    <th>Unattempted</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsPayload.results.map((row, i) => (
                    <tr key={row.attemptId} className={i === 0 ? "adm-table-rank1" : ""}>
                      <td><span className="adm-rank">{i + 1}</span></td>
                      <td>{row.studentName}</td>
                      <td className="adm-td-muted">{row.studentEmail}</td>
                      {(resultsPayload.sections || []).map((s, si) => (
                        <td key={`${row.attemptId}-${s.sectionId}`}>{row.sectionScores?.[si]?.marks ?? 0}</td>
                      ))}
                      <td><strong>{row.totalScore}</strong></td>
                      <td className="adm-cell-correct">{row.correctCount}</td>
                      <td className="adm-cell-wrong">{row.wrongCount}</td>
                      <td>{row.unattemptedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-empty">No submitted results yet.</p>
            )}
          </div>
        </section>

        {/* ── ATTEMPTS TABLE ── */}
        <section className="adm-card">
          <div className="adm-card-header">Submitted Attempts</div>
          <div className="adm-card-body adm-table-wrap">
            {attempts.length ? (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Score</th>
                    <th>Correct</th>
                    <th>Wrong</th>
                    <th>Unattempted</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => (
                    <tr key={a._id}>
                      <td>{i + 1}</td>
                      <td>{a.userId?.name || "—"}</td>
                      <td className="adm-td-muted">{a.userId?.email || "—"}</td>
                      <td><strong>{a.score}</strong></td>
                      <td className="adm-cell-correct">{a.correctCount}</td>
                      <td className="adm-cell-wrong">{a.wrongCount}</td>
                      <td>{a.unattemptedCount}</td>
                      <td><span className="adm-reason-badge">{a.submittedReason}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-empty">No submitted attempts yet.</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
