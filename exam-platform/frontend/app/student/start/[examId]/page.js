"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { apiRequest, resolveApiOrigin } from "../../../../lib/api";
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
  const [examStartSignal, setExamStartSignal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [preloadingExam, setPreloadingExam] = useState(false);
  const [preloadedExamData, setPreloadedExamData] = useState(null);
  const [preloadAttempted, setPreloadAttempted] = useState(false);

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
    if (!joined || !joinedToken || !params.examId || !scheduleTimestamp) {
      return;
    }

    if (preloadedExamData || preloadingExam || preloadAttempted) {
      return;
    }

    if (Date.now() >= scheduleTimestamp) {
      return;
    }

    if (remainingSeconds <= 0 || remainingSeconds > 30) {
      return;
    }

    const preloadExam = async () => {
      setPreloadingExam(true);
      setPreloadAttempted(true);
      try {
        const payload = await apiRequest(`/student/exams/${params.examId}/preload`, {
          token: joinedToken,
        });
        setPreloadedExamData(payload);
        sessionStorage.setItem(`exam-preload:${params.examId}`, JSON.stringify(payload));
      } catch {
      } finally {
        setPreloadingExam(false);
      }
    };

    preloadExam();
  }, [joined, joinedToken, params.examId, scheduleTimestamp, remainingSeconds, preloadedExamData, preloadingExam, preloadAttempted]);

  useEffect(() => {
    if (!joined || !joinedToken) {
      return;
    }

    if (!examStartSignal && scheduleTimestamp && Date.now() < scheduleTimestamp) {
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

        const cachedPreload = preloadedExamData || (() => {
          try {
            const raw = sessionStorage.getItem(`exam-preload:${params.examId}`);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();

        const seedPayload = {
          attemptId: attempt._id,
          startTime: attempt.startTime || new Date().toISOString(),
          examData: cachedPreload || null,
          answers: {},
        };
        sessionStorage.setItem(`attempt-seed:${attempt._id}`, JSON.stringify(seedPayload));

        router.replace(`/student/exam/${attempt._id}`);
      } catch (err) {
        setError(err.message);
      } finally {
        setStarting(false);
      }
    };

    startAttempt();
  }, [joined, joinedToken, params.examId, router, scheduleTimestamp, examStartSignal, preloadedExamData]);

  useEffect(() => {
    if (!joined || !params.examId) {
      return;
    }

    const shouldWaitForStart = scheduleTimestamp && Date.now() < scheduleTimestamp;
    if (!shouldWaitForStart) {
      return;
    }

    const socket = io(resolveApiOrigin(), {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join-exam-room", { examId: params.examId });
    });

    socket.on("exam-started", (payload) => {
      if (!payload?.examId || String(payload.examId) !== String(params.examId)) {
        return;
      }
      setExamStartSignal(true);
      setRemainingSeconds(0);
      setMessage("Exam has started. Opening questions...");
    });

    return () => {
      socket.disconnect();
    };
  }, [joined, params.examId, scheduleTimestamp]);

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
      setExamStartSignal(false);
      setPreloadedExamData(null);
      setPreloadAttempted(false);

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
            <p className="stu-muted">Loading exam details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!exam) {
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
          <p className="stu-alert stu-alert-error">{error || "Exam not available"}</p>
        </main>
      </div>
    );
  }

  if (joined) {
    const isBeforeStart = scheduleTimestamp && Date.now() < scheduleTimestamp;

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
            <h1 className="stu-title">{exam.title}</h1>

            {isBeforeStart ? (
              <>
                <p className="stu-muted">Exam starts at: {formatDateTime(exam.scheduledAt)}</p>
                <div className="stu-timer">Countdown: {formatCountdown(remainingSeconds)}</div>
                <p className="stu-muted">Questions will open automatically when countdown reaches zero.</p>
                {preloadingExam ? <p className="stu-muted">Preparing exam paper...</p> : null}
              </>
            ) : (
              <p className="stu-muted">Exam time reached. Loading questions...</p>
            )}

            {starting ? <p className="stu-muted">Starting exam...</p> : null}
            {error ? <p className="stu-alert stu-alert-error">{error}</p> : null}
            {message ? <p className="stu-alert stu-alert-success">{message}</p> : null}
          </div>
        </main>
      </div>
    );
  }

  const examAlreadyStarted = exam.scheduledAt && Date.now() > new Date(exam.scheduledAt).getTime();

  if (examAlreadyStarted) {
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
          <div className="stu-card stu-form">
            <h1 className="stu-title">{exam.title}</h1>
            <p className="stu-alert stu-alert-error">
              This exam has already started. Registration is closed.
            </p>
            <div className="stu-meta-list">
              <div className="stu-meta-item"><span>Started at</span><strong>{formatDateTime(exam.scheduledAt)}</strong></div>
              <div className="stu-meta-item"><span>Duration</span><strong>{exam.duration} minutes</strong></div>
            </div>
            <button className="stu-btn stu-btn-primary" disabled>
              Exam Has Started
            </button>
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
        </div>
      </header>

      <main className="stu-main">
        <form className="stu-card stu-form" onSubmit={handleStartExam}>
          <h1 className="stu-title">{exam.title}</h1>

          <div className="stu-meta-list">
            <div className="stu-meta-item"><span>Scheduled</span><strong>{formatDateTime(exam.scheduledAt)}</strong></div>
            <div className="stu-meta-item"><span>Duration</span><strong>{exam.duration} minutes</strong></div>
            <div className="stu-meta-item"><span>Total Questions</span><strong>{exam.totalQuestions}</strong></div>
          </div>

          <div className="stu-form-grid">
            <div className="stu-field">
              <label className="stu-label" htmlFor="student-name">Full Name</label>
              <input
                id="student-name"
                className="stu-input"
                placeholder="Enter full name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="stu-field">
              <label className="stu-label" htmlFor="student-email">Email Address</label>
              <input
                id="student-email"
                className="stu-input"
                type="email"
                placeholder="Enter email"
                value={form.email}
                onChange={(event) => {
                  const email = event.target.value;
                  setForm((prev) => ({ ...prev, email }));
                  setOtpSent(false);
                  setOtpVerified(false);
                }}
                required
              />
            </div>

            <div className="stu-inline-actions">
              <button className="stu-btn stu-btn-secondary" disabled={otpLoading} onClick={sendOtp} type="button">
                {otpLoading ? "Sending OTP..." : "Send OTP"}
              </button>
              <span className="stu-status-text">{otpSent ? "OTP sent" : "OTP not sent"}</span>
            </div>

            <div className="stu-field">
              <label className="stu-label" htmlFor="student-otp">OTP</label>
              <input
                id="student-otp"
                className="stu-input"
                placeholder="Enter OTP"
                value={form.otp}
                onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value }))}
                required
              />
            </div>

            <div className="stu-inline-actions">
              <button className="stu-btn stu-btn-secondary" disabled={verifyLoading || !otpSent} onClick={verifyOtp} type="button">
                {verifyLoading ? "Verifying..." : "Verify OTP"}
              </button>
              <span className="stu-status-text">{otpVerified ? "Email verified" : "Email not verified"}</span>
            </div>

            <div className="stu-field">
              <label className="stu-label" htmlFor="student-institute">Institute Name</label>
              <input
                id="student-institute"
                className="stu-input"
                placeholder="Enter institute name"
                value={form.instituteName}
                onChange={(event) => setForm((prev) => ({ ...prev, instituteName: event.target.value }))}
                required
              />
            </div>
          </div>

          <button className="stu-btn stu-btn-primary" disabled={joining} type="submit">
            {joining ? "Preparing..." : "Start Exam"}
          </button>

          {error ? <p className="stu-alert stu-alert-error">{error}</p> : null}
          {message ? <p className="stu-alert stu-alert-success">{message}</p> : null}
        </form>
      </main>
    </div>
  );
}
