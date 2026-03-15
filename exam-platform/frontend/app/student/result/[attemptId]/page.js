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
      router.push("/student/login");
      return;
    }

    apiRequest(`/student/attempts/${params.attemptId}/result`, { token: auth.token })
      .then((data) => setResult(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.attemptId, router]);

  if (loading) {
    return (
      <main className="container">
        <p>Loading result...</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="container">
        <p className="error">{error || "Result not available"}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card">
        <h1 className="title">Result - {result.examTitle}</h1>
        <p className="muted">Submission reason: {result.submittedReason}</p>

        <div className="grid grid-2">
          <div className="card">
            <h3 className="title">Total Score</h3>
            <p style={{ fontSize: 28, margin: 0 }}>{result.score}</p>
          </div>
          <div className="card">
            <h3 className="title">Overall Breakdown</h3>
            <p>Correct: {result.correctCount}</p>
            <p>Wrong: {result.wrongCount}</p>
            <p>Unattempted: {result.unattemptedCount}</p>
          </div>
        </div>

        <h3>Section-wise Performance</h3>
        <table className="table">
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
                <td>{section.correct}</td>
                <td>{section.wrong}</td>
                <td>{section.unattempted}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 16 }}>
          <Link className="button" href="/student/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
