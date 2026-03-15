"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../lib/api";
import { getAuth } from "../../../../lib/auth";

const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examState, setExamState] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visited, setVisited] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenArmed, setFullscreenArmed] = useState(false);

  const submittingRef = useRef(false);

  const questions = examState?.questions || [];
  const currentQuestion = questions[currentIndex];

  const submitExam = useCallback(
    async (reason = "manual") => {
      if (submittingRef.current) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);

      try {
        const result = await apiRequest(`/student/attempts/${params.attemptId}/submit`, {
          method: "POST",
          token,
          body: { reason },
        });

        router.replace(`/student/result/${result.attemptId}`);
      } catch (err) {
        setError(err.message);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [params.attemptId, router, token]
  );

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth?.user?.role !== "student") {
      router.push("/student/dashboard");
      return;
    }

    setToken(auth.token);

    apiRequest(`/student/attempts/${params.attemptId}`, { token: auth.token })
      .then((data) => {
        setExamState(data);
        setAnswers(data.answers || {});

        const initialVisited = {};
        if (data.questions?.[0]?._id) {
          initialVisited[data.questions[0]._id] = true;
        }
        setVisited(initialVisited);

        const examSeconds = data.exam.duration * 60;
        const elapsedSeconds = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000);
        setRemainingSeconds(Math.max(examSeconds - elapsedSeconds, 0));
      })
      .catch((err) => {
        if (err.message.includes("already submitted")) {
          router.replace(`/student/result/${params.attemptId}`);
          return;
        }

        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [params.attemptId, router]);

  useEffect(() => {
    if (!examState) {
      return;
    }

    if (remainingSeconds <= 0) {
      submitExam("timer");
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [examState, remainingSeconds, submitExam]);

  useEffect(() => {
    if (!examState) {
      return;
    }

    const triggerCheatSubmit = () => {
      submitExam("cheating");
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        triggerCheatSubmit();
      }
    };

    const onBlur = () => {
      triggerCheatSubmit();
    };

    const onFullscreenChange = () => {
      if (fullscreenArmed && !document.fullscreenElement) {
        triggerCheatSubmit();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    if (document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .then(() => setFullscreenArmed(true))
        .catch(() => {
          setFullscreenArmed(false);
        });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [examState, fullscreenArmed, submitExam]);

  const selectAnswer = async (questionId, selectedOption) => {
    setSaving(true);
    setError("");

    const nextAnswers = { ...answers, [questionId]: selectedOption };
    setAnswers(nextAnswers);

    try {
      const data = await apiRequest(`/student/attempts/${params.attemptId}/answer`, {
        method: "PATCH",
        token,
        body: { questionId, selectedOption },
      });

      if (data.submitted) {
        router.replace(`/student/result/${params.attemptId}`);
      }
    } catch (err) {
      if (err.message.includes("submitted")) {
        router.replace(`/student/result/${params.attemptId}`);
        return;
      }
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const goToQuestion = (index) => {
    const boundedIndex = Math.max(0, Math.min(index, questions.length - 1));
    setCurrentIndex(boundedIndex);

    const question = questions[boundedIndex];
    if (question?._id) {
      setVisited((prev) => ({ ...prev, [question._id]: true }));
    }
  };

  const navigatorClass = useMemo(
    () =>
      questions.map((question, index) => {
        if (!visited[question._id]) {
          return "stu-nav-not-visited";
        }

        if (answers[question._id] === undefined) {
          return "stu-nav-unanswered";
        }

        return "stu-nav-answered";
      }),
    [answers, questions, visited]
  );

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
            <p className="stu-muted">Loading exam...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!examState || !currentQuestion) {
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
          <p className="stu-alert stu-alert-error">{error || "Exam data unavailable"}</p>
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
          <div className="stu-timer">Time Left: {formatTime(Math.max(remainingSeconds, 0))}</div>
        </div>
      </header>

      <main className="stu-main">
        <div className="stu-card stu-panel-title">
          <h1 className="stu-title">{examState.exam.title}</h1>
          <p className="stu-muted">Question {currentIndex + 1} of {questions.length}</p>
        </div>

        <section className="stu-exam-layout">
          <div className="stu-card">
            <p className="stu-muted">Section: {currentQuestion.sectionName}</p>
            <h2 className="stu-q-title">Q{currentIndex + 1}. {currentQuestion.questionText}</h2>

            <div className="stu-options">
              {currentQuestion.options.map((option, index) => (
                <label className="stu-option" key={index}>
                  <input
                    checked={answers[currentQuestion._id] === index}
                    name={`question-${currentQuestion._id}`}
                    onChange={() => selectAnswer(currentQuestion._id, index)}
                    type="radio"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>

            <div className="stu-actions-row">
              <button
                className="stu-btn stu-btn-secondary"
                disabled={currentIndex === 0}
                onClick={() => goToQuestion(currentIndex - 1)}
                type="button"
              >
                Previous
              </button>

              <button
                className="stu-btn stu-btn-primary"
                disabled={currentIndex === questions.length - 1}
                onClick={() => goToQuestion(currentIndex + 1)}
                type="button"
              >
                Next
              </button>

              <button className="stu-btn stu-btn-danger" disabled={submitting} onClick={() => submitExam("manual")} type="button">
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            </div>

            {saving ? <p className="stu-muted">Saving answer...</p> : null}
            {error ? <p className="stu-alert stu-alert-error">{error}</p> : null}
          </div>

          <aside className="stu-card">
            <h3 className="stu-subtitle">Question Navigator</h3>
            <div className="stu-nav-grid">
              {questions.map((question, index) => (
                <button
                  className={`stu-nav-btn ${navigatorClass[index]} ${currentIndex === index ? "stu-nav-current" : ""}`}
                  key={question._id}
                  onClick={() => goToQuestion(index)}
                  type="button"
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="stu-nav-legend">
              <p className="stu-muted">Grey: Not visited</p>
              <p className="stu-muted">Orange: Visited but unanswered</p>
              <p className="stu-muted">Green: Answered</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
