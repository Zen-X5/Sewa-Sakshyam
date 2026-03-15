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
      <main className="container">
        <p>Loading exam report...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card row space-between">
        <div>
          <h1 className="title">Exam Report</h1>
          <p className="muted">{resultsPayload?.exam?.title || "-"}</p>
        </div>
        <div className="row">
          <button className="button outline" onClick={() => router.push("/admin/dashboard")} type="button">
            Back to Dashboard
          </button>
          <button className="button secondary" onClick={handleRefresh} type="button">
            Refresh
          </button>
          <button className="button secondary" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h4 className="title">Exam Summary</h4>
        <div className="row space-between">
          <p style={{ margin: 0 }}>
            <strong>Title:</strong> {resultsPayload?.exam?.title || "-"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Scheduled:</strong> {scheduledAtLabel}
          </p>
        </div>
      </div>

      <div className="card">
        <h4 className="title">Result Summary (Sorted by Total Marks)</h4>
        {resultsPayload?.results?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {(resultsPayload.sections || []).map((section) => (
                  <th key={section.sectionId}>{section.sectionName}</th>
                ))}
                <th>Total</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Unattempted</th>
              </tr>
            </thead>
            <tbody>
              {resultsPayload.results.map((resultRow) => (
                <tr key={resultRow.attemptId}>
                  <td>{resultRow.studentName}</td>
                  <td>{resultRow.studentEmail}</td>
                  {(resultsPayload.sections || []).map((section, sectionIndex) => (
                    <td key={`${resultRow.attemptId}-${section.sectionId}`}>
                      {resultRow.sectionScores?.[sectionIndex]?.marks ?? 0}
                    </td>
                  ))}
                  <td>{resultRow.totalScore}</td>
                  <td>{resultRow.correctCount}</td>
                  <td>{resultRow.wrongCount}</td>
                  <td>{resultRow.unattemptedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No submitted results yet.</p>
        )}
      </div>

      <div className="card">
        <h4 className="title">Submitted Attempts</h4>
        {attempts.length ? (
          <table className="table">
            <thead>
              <tr>
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
              {attempts.map((attempt) => (
                <tr key={attempt._id}>
                  <td>{attempt.userId?.name || "-"}</td>
                  <td>{attempt.userId?.email || "-"}</td>
                  <td>{attempt.score}</td>
                  <td>{attempt.correctCount}</td>
                  <td>{attempt.wrongCount}</td>
                  <td>{attempt.unattemptedCount}</td>
                  <td>{attempt.submittedReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No submitted attempts yet.</p>
        )}
      </div>
    </main>
  );
}
