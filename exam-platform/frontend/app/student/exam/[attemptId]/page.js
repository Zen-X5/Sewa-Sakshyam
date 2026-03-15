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
      router.push("/student/login");
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
          return "nav-not-visited";
        }

        if (answers[question._id] === undefined) {
          return "nav-unanswered";
        }

        return "nav-answered";
      }),
    [answers, questions, visited]
  );

  if (loading) {
    return (
      <main className="container">
        <p>Loading exam...</p>
      </main>
    );
  }

  if (!examState || !currentQuestion) {
    return (
      <main className="container">
        <p className="error">{error || "Exam data unavailable"}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card row space-between">
        <div>
          <h1 className="title">{examState.exam.title}</h1>
          <p className="muted">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="timer">Time Left: {formatTime(Math.max(remainingSeconds, 0))}</div>
      </div>

      <section className="exam-layout">
        <div className="card">
          <p className="muted">Section: {currentQuestion.sectionName}</p>
          <h2 className="title">Q{currentIndex + 1}. {currentQuestion.questionText}</h2>

          <div>
            {currentQuestion.options.map((option, index) => (
              <label className="question-option" key={index}>
                <input
                  checked={answers[currentQuestion._id] === index}
                  name={`question-${currentQuestion._id}`}
                  onChange={() => selectAnswer(currentQuestion._id, index)}
                  type="radio"
                />{" "}
                {option}
              </label>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="button outline"
              disabled={currentIndex === 0}
              onClick={() => goToQuestion(currentIndex - 1)}
              type="button"
            >
              Previous
            </button>

            <button
              className="button"
              disabled={currentIndex === questions.length - 1}
              onClick={() => goToQuestion(currentIndex + 1)}
              type="button"
            >
              Next
            </button>

            <button className="button danger" disabled={submitting} onClick={() => submitExam("manual")} type="button">
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          </div>

          {saving ? <p className="muted">Saving answer...</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </div>

        <aside className="card">
          <h3 className="title">Question Navigator</h3>
          <div className="navigator-grid">
            {questions.map((question, index) => (
              <button
                className={`nav-button ${navigatorClass[index]} ${currentIndex === index ? "nav-current" : ""}`}
                key={question._id}
                onClick={() => goToQuestion(index)}
                type="button"
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <p className="muted">Grey: Not Visited</p>
            <p className="muted">Orange: Visited but Unanswered</p>
            <p className="muted">Green: Answered</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
