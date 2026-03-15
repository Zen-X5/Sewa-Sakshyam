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

  useEffect(() => {
    apiRequest("/student/exams", { skipAuth: true })
      .then((data) => setExams(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="container">
        <p>Loading exams...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card row space-between">
        <div>
          <h1 className="title">Student Exam Portal</h1>
          <p className="muted">No login required. Verify email OTP and start when exam countdown reaches zero.</p>
        </div>
        <Link className="button outline" href="/">
          Home
        </Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid grid-2">
        {exams.map((exam) => (
          <article className="card" key={exam._id}>
            <h2 className="title">{exam.title}</h2>
            <p className="muted">Scheduled: {formatDateTime(exam.scheduledAt)}</p>
            <p className="muted">Duration: {exam.duration} minutes</p>
            <p className="muted">
              Questions: {exam.questionCount} | Sections: {exam.sectionCount}
            </p>
            <p className="muted">
              Marking: +{exam.markingScheme.correct} / {exam.markingScheme.wrong}
            </p>

            <Link className="button" href={`/student/start/${exam._id}`}>
              Start Exam
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
