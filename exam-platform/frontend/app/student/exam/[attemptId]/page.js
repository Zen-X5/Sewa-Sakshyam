"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, resolveApiBaseUrl } from "../../../../lib/api";
import { getAuth } from "../../../../lib/auth";

const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const QuestionPane = memo(function QuestionPane({
  currentIndex,
  currentQuestion,
  selectedOption,
  onSelectAnswer,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  onSubmit,
  submitting,
}) {
  return (
    <div className="stu-card">
      <p className="stu-muted">Section: {currentQuestion.sectionName}</p>
      <h2 className="stu-q-title">Q{currentIndex + 1}. {currentQuestion.questionText}</h2>

      {currentQuestion.imageUrl ? (
        <div className="stu-q-image">
          <img src={currentQuestion.imageUrl} alt="Question diagram" />
        </div>
      ) : null}

      <div className="stu-options">
        {currentQuestion.options.map((option, index) => (
          <label className="stu-option" key={index}>
            <input
              checked={selectedOption === index}
              name={`question-${currentQuestion._id}`}
              onChange={() => onSelectAnswer(currentQuestion._id, index)}
              type="radio"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>

      <div className="stu-actions-row">
        <button className="stu-btn stu-btn-secondary" disabled={!canGoPrevious} onClick={onPrevious} type="button">
          Previous
        </button>

        <button className="stu-btn stu-btn-primary" disabled={!canGoNext} onClick={onNext} type="button">
          Next
        </button>

        <button className="stu-btn stu-btn-danger" disabled={submitting} onClick={onSubmit} type="button">
          {submitting ? "Submitting..." : "Submit Exam"}
        </button>
      </div>
    </div>
  );
});

const NavigatorPane = memo(function NavigatorPane({ questions, navigatorClass, currentIndex, onGoToQuestion }) {
  return (
    <aside className="stu-card">
      <h3 className="stu-subtitle">Question Navigator</h3>
      <div className="stu-nav-grid">
        {questions.map((question, index) => (
          <button
            className={`stu-nav-btn ${navigatorClass[index]} ${currentIndex === index ? "stu-nav-current" : ""}`}
            key={question._id}
            onClick={() => onGoToQuestion(index)}
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
  );
});

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examState, setExamState] = useState(null);
  const [attemptStartTime, setAttemptStartTime] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visited, setVisited] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenArmed, setFullscreenArmed] = useState(false);

  const submittingRef = useRef(false);
  const answersRef = useRef({});
  const flushInFlightRef = useRef(false);
  const pendingFlushRef = useRef(false);

  const questions = examState?.questions || [];
  const currentQuestion = questions[currentIndex];

  const flushAnswers = useCallback(
    async (reason = "periodic", options = {}) => {
      const keepalive = Boolean(options.keepalive);
      if (!token || !params.attemptId || submittingRef.current) {
        return;
      }

      if (flushInFlightRef.current) {
        pendingFlushRef.current = true;
        return;
      }

      flushInFlightRef.current = true;
      if (!keepalive && reason !== "periodic") {
        setSaving(true);
      }

      try {
        const payload = {
          answers: answersRef.current,
          reason,
        };

        let responseData = null;

        if (keepalive) {
          const response = await fetch(`${resolveApiBaseUrl()}/student/attempts/${params.attemptId}/save`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
            keepalive: true,
          });

          responseData = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(responseData.message || "Failed to save answers");
          }
        } else {
          responseData = await apiRequest(`/student/attempts/${params.attemptId}/save`, {
            method: "POST",
            token,
            body: payload,
          });
        }

        if (responseData?.submitted) {
          router.replace(`/student/result/${params.attemptId}`);
        }
      } catch (err) {
        if (!keepalive) {
          if (String(err.message || "").toLowerCase().includes("submitted")) {
            router.replace(`/student/result/${params.attemptId}`);
          } else {
            setError(err.message || "Failed to save answers");
          }
        }
      } finally {
        flushInFlightRef.current = false;
        setSaving(false);

        if (pendingFlushRef.current && !keepalive) {
          pendingFlushRef.current = false;
          setTimeout(() => {
            flushAnswers("queued");
          }, 0);
        }
      }
    },
    [params.attemptId, router, token]
  );

  const submitExam = useCallback(
    async (reason = "manual") => {
      if (submittingRef.current) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      setError("");

      try {
        await flushAnswers("submit");

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
    [flushAnswers, params.attemptId, router, token]
  );

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth?.user?.role !== "student") {
      router.push("/student/dashboard");
      return;
    }

    setToken(auth.token);

    const hydrateFromSeed = () => {
      try {
        const raw = sessionStorage.getItem(`attempt-seed:${params.attemptId}`);
        if (!raw) {
          return false;
        }

        const seed = JSON.parse(raw);
        if (!seed?.examData?.exam || !Array.isArray(seed?.examData?.questions)) {
          return false;
        }

        sessionStorage.removeItem(`attempt-seed:${params.attemptId}`);

        const seededAnswers = seed.answers || {};
        const seededExamState = {
          exam: seed.examData.exam,
          sections: seed.examData.sections || [],
          questions: seed.examData.questions || [],
          answers: seededAnswers,
        };

        setExamState(seededExamState);
        setAnswers(seededAnswers);
        answersRef.current = seededAnswers;
        setAttemptStartTime(seed.startTime || new Date().toISOString());

        const initialVisited = {};
        if (seededExamState.questions?.[0]?._id) {
          initialVisited[seededExamState.questions[0]._id] = true;
        }
        setVisited(initialVisited);

        const examSeconds = Number(seededExamState.exam.duration || 0) * 60;
        const elapsedSeconds = Math.floor((Date.now() - new Date(seed.startTime || Date.now()).getTime()) / 1000);
        setRemainingSeconds(Math.max(examSeconds - elapsedSeconds, 0));

        return true;
      } catch {
        return false;
      }
    };

    if (hydrateFromSeed()) {
      setLoading(false);
      return;
    }

    apiRequest(`/student/attempts/${params.attemptId}`, { token: auth.token })
      .then((data) => {
        setExamState(data);
        setAttemptStartTime(data.startTime);
        setAnswers(data.answers || {});
        answersRef.current = data.answers || {};

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
    if (!examState || !attemptStartTime) {
      return;
    }

    if (remainingSeconds <= 0) {
      submitExam("timer");
      return;
    }

    // Recompute from startTime on each tick to prevent JS interval drift
    const examDurationMs = Number(examState.exam.duration || 0) * 60 * 1000;
    const startMs = new Date(attemptStartTime).getTime();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const fresh = Math.max(0, Math.ceil((examDurationMs - elapsed) / 1000));
      setRemainingSeconds(fresh);
    }, 1000);

    return () => clearInterval(interval);
  }, [examState, attemptStartTime, remainingSeconds, submitExam]);

  useEffect(() => {
    if (!examState) {
      return;
    }

    const interval = setInterval(() => {
      flushAnswers("periodic");
    }, 15000);

    return () => clearInterval(interval);
  }, [examState, flushAnswers]);

  useEffect(() => {
    if (!examState) {
      return;
    }

    const flushOnExit = () => {
      flushAnswers("unload", { keepalive: true });
    };

    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);

    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [examState, flushAnswers]);

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

    // NOTE: window.blur is intentionally NOT used — it fires on any OS notification,
    // phone banner, address bar click, or popup, which would unfairly penalise students.
    // visibilitychange (tab switch / minimize) is sufficient for cheat detection.

    const onFullscreenChange = () => {
      if (fullscreenArmed && !document.fullscreenElement) {
        triggerCheatSubmit();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
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
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [examState, fullscreenArmed, submitExam]);

  const selectAnswer = useCallback((questionId, selectedOption) => {
    setError("");

    setAnswers((prev) => {
      const next = { ...prev, [questionId]: selectedOption };
      answersRef.current = next;
      return next;
    });
  }, []);

  const goToQuestion = useCallback(
    (index) => {
      const boundedIndex = Math.max(0, Math.min(index, questions.length - 1));
      setCurrentIndex(boundedIndex);

      const question = questions[boundedIndex];
      if (question?._id) {
        setVisited((prev) => ({ ...prev, [question._id]: true }));
      }

      flushAnswers("navigation");
    },
    [flushAnswers, questions]
  );

  const onNext = useCallback(() => {
    goToQuestion(currentIndex + 1);
  }, [currentIndex, goToQuestion]);

  const onPrevious = useCallback(() => {
    goToQuestion(currentIndex - 1);
  }, [currentIndex, goToQuestion]);

  const navigatorClass = useMemo(
    () =>
      questions.map((question) => {
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
          {attemptStartTime ? <p className="stu-muted">Started at: {new Date(attemptStartTime).toLocaleTimeString()}</p> : null}
        </div>

        <section className="stu-exam-layout">
          <QuestionPane
            currentIndex={currentIndex}
            currentQuestion={currentQuestion}
            selectedOption={answers[currentQuestion._id]}
            onSelectAnswer={selectAnswer}
            onPrevious={onPrevious}
            onNext={onNext}
            canGoPrevious={currentIndex !== 0}
            canGoNext={currentIndex !== questions.length - 1}
            onSubmit={() => submitExam("manual")}
            submitting={submitting}
          />

          <NavigatorPane
            questions={questions}
            navigatorClass={navigatorClass}
            currentIndex={currentIndex}
            onGoToQuestion={goToQuestion}
          />
        </section>

        {saving ? <p className="stu-muted">Saving latest answers...</p> : null}
        {error ? <p className="stu-alert stu-alert-error">{error}</p> : null}
      </main>
    </div>
  );
}
