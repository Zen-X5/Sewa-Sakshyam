"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { saveAuth } from "../../../../lib/auth";

const formatDateTime = (value) => new Date(value).toLocaleString();
const formatCountdown = (seconds) => {
  const safe = Math.max(0, seconds);
  const hours = String(Math.floor(safe / 3600)).padStart(2, "0");
  const mins = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
};

export default function StartExamPage() {
  const params = useParams();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", instituteName: "", otp: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinedToken, setJoinedToken] = useState("");
  const [joined, setJoined] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const scheduleTimestamp = useMemo(() => {
    if (!exam?.scheduledAt) {
      return 0;
    }
    return new Date(exam.scheduledAt).getTime();
  }, [exam]);

  useEffect(() => {
    apiRequest(`/student/exams/${params.examId}/instructions`, { skipAuth: true })
      .then((data) => setExam(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.examId]);

  useEffect(() => {
    if (!joined || !scheduleTimestamp) {
      return;
    }

    const computeRemaining = () => Math.ceil((scheduleTimestamp - Date.now()) / 1000);
    const initial = computeRemaining();

    if (initial <= 0) {
      return;
    }

    setRemainingSeconds(initial);

    const interval = setInterval(() => {
      const next = computeRemaining();
      setRemainingSeconds(next);
      if (next <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [joined, scheduleTimestamp]);

  useEffect(() => {
    if (!joined || !joinedToken) {
      return;
    }

    if (scheduleTimestamp && Date.now() < scheduleTimestamp) {
      return;
    }

    const startAttempt = async () => {
      setStarting(true);
      setError("");
      try {
        const attempt = await apiRequest(`/student/exams/${params.examId}/start`, {
          method: "POST",
          token: joinedToken,
        });
        router.replace(`/student/exam/${attempt._id}`);
      } catch (err) {
        setError(err.message);
      } finally {
        setStarting(false);
      }
    };

    startAttempt();
  }, [joined, joinedToken, params.examId, router, scheduleTimestamp]);

  const sendOtp = async () => {
    if (!form.email) {
      setError("Enter email first");
      return;
    }

    setOtpLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await apiRequest("/auth/send-otp", {
        method: "POST",
        body: { email: form.email, purpose: "exam" },
        skipAuth: true,
      });

      setOtpSent(true);
      setOtpVerified(false);
      setMessage(payload.devOtp ? `OTP sent. Dev OTP: ${payload.devOtp}` : payload.message || "OTP sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!form.email || !form.otp) {
      setError("Enter email and OTP");
      return;
    }

    setVerifyLoading(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: { email: form.email, otp: form.otp },
        skipAuth: true,
      });

      setOtpVerified(true);
      setMessage("Email verified successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleStartExam = async (event) => {
    event.preventDefault();

    if (!otpVerified) {
      setError("Verify your email using OTP before starting exam");
      return;
    }

    setJoining(true);
    setError("");
    setMessage("");

    try {
      const payload = await apiRequest(`/student/exams/${params.examId}/join`, {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          instituteName: form.instituteName,
        },
        skipAuth: true,
      });

      saveAuth(payload);
      setJoinedToken(payload.token);
      setJoined(true);

      if (!payload.exam?.scheduledAt || Date.now() >= new Date(payload.exam.scheduledAt).getTime()) {
        setMessage("Exam has started. Opening questions...");
      } else {
        const seconds = Math.ceil((new Date(payload.exam.scheduledAt).getTime() - Date.now()) / 1000);
        setRemainingSeconds(seconds);
        setMessage("You are registered. Wait for countdown to reach zero.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="container">
        <p>Loading exam details...</p>
      </main>
    );
  }

  if (!exam) {
    return (
      <main className="container">
        <p className="error">{error || "Exam not available"}</p>
      </main>
    );
  }

  if (joined) {
    const isBeforeStart = scheduleTimestamp && Date.now() < scheduleTimestamp;

    return (
      <main className="container">
        <div className="card">
          <h1 className="title">{exam.title}</h1>
          {isBeforeStart ? (
            <>
              <p className="muted">Exam starts at: {formatDateTime(exam.scheduledAt)}</p>
              <p className="timer">Countdown: {formatCountdown(remainingSeconds)}</p>
              <p className="muted">Questions will appear automatically when countdown reaches zero.</p>
            </>
          ) : (
            <p className="muted">Exam time reached. Loading questions...</p>
          )}
          {starting ? <p className="muted">Starting exam...</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <form className="card stack" onSubmit={handleStartExam}>
        <h1 className="title">{exam.title}</h1>

        <p className="muted">Scheduled: {formatDateTime(exam.scheduledAt)}</p>
        <p className="muted">Duration: {exam.duration} minutes</p>
        <p className="muted">Total Questions: {exam.totalQuestions}</p>

        <input
          className="input"
          placeholder="Full name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />

        <input
          className="input"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => {
            const email = event.target.value;
            setForm((prev) => ({ ...prev, email }));
            setOtpSent(false);
            setOtpVerified(false);
          }}
          required
        />

        <div className="row">
          <button className="button outline" disabled={otpLoading} onClick={sendOtp} type="button">
            {otpLoading ? "Sending OTP..." : "Send OTP"}
          </button>
          <span className="muted">{otpSent ? "OTP sent" : "OTP not sent"}</span>
        </div>

        <input
          className="input"
          placeholder="Enter OTP"
          value={form.otp}
          onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value }))}
          required
        />

        <div className="row">
          <button className="button outline" disabled={verifyLoading || !otpSent} onClick={verifyOtp} type="button">
            {verifyLoading ? "Verifying..." : "Verify OTP"}
          </button>
          <span className="muted">{otpVerified ? "Email verified" : "Email not verified"}</span>
        </div>

        <input
          className="input"
          placeholder="Institute name"
          value={form.instituteName}
          onChange={(event) => setForm((prev) => ({ ...prev, instituteName: event.target.value }))}
          required
        />

        <button className="button" disabled={joining} type="submit">
          {joining ? "Preparing..." : "Start Exam"}
        </button>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </form>
    </main>
  );
}
