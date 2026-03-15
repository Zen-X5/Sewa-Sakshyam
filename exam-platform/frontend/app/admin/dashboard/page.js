"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { clearAuth, getAuth } from "../../../lib/auth";

const defaultQuestionDraft = {
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
};

const toDateTimeLocal = (value) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const sortQuestions = (questions = []) => [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));

export default function AdminDashboardPage() {
  const router = useRouter();
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exams, setExams] = useState([]);

  const [examForm, setExamForm] = useState({
    title: "",
    duration: 180,
    scheduledAt: toDateTimeLocal(),
    correct: 4,
    wrong: -1,
  });

  const [sectionNames, setSectionNames] = useState({});
  const [editingSectionNames, setEditingSectionNames] = useState({});
  const [questionDrafts, setQuestionDrafts] = useState({});
  const [editingQuestionBySection, setEditingQuestionBySection] = useState({});
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [previewExamId, setPreviewExamId] = useState(null);
  const [expandedExams, setExpandedExams] = useState({});

  const token = useMemo(() => auth?.token, [auth]);

  const loadExams = async (currentToken) => {
    const data = await apiRequest("/admin/exams", { token: currentToken });
    setExams(data);
  };

  useEffect(() => {
    const localAuth = getAuth();
    if (!localAuth || localAuth?.user?.role !== "admin") {
      router.push("/admin/login");
      return;
    }

    setAuth(localAuth);
    loadExams(localAuth.token)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/admin/login");
  };

  const createExam = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiRequest("/admin/exams", {
        method: "POST",
        token,
        body: {
          title: examForm.title,
          duration: Number(examForm.duration),
          scheduledAt: new Date(examForm.scheduledAt).toISOString(),
          markingScheme: {
            correct: Number(examForm.correct),
            wrong: Number(examForm.wrong),
            unattempted: 0,
          },
        },
      });

      setMessage("Exam created");
      setExamForm({ title: "", duration: 180, scheduledAt: toDateTimeLocal(), correct: 4, wrong: -1 });
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const addSection = async (examId) => {
    const name = sectionNames[examId];
    if (!name) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest(`/admin/exams/${examId}/sections`, {
        method: "POST",
        token,
        body: { name },
      });

      setSectionNames((prev) => ({ ...prev, [examId]: "" }));
      setMessage("Section added");
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditSectionName = (section) => {
    setEditingSectionNames((prev) => ({ ...prev, [section._id]: section.name }));
  };

  const cancelEditSectionName = (sectionId) => {
    setEditingSectionNames((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  };

  const saveSectionName = async (sectionId) => {
    const name = (editingSectionNames[sectionId] || "").trim();
    if (!name) {
      setError("Section name is required");
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest(`/admin/sections/${sectionId}`, {
        method: "PATCH",
        token,
        body: { name },
      });

      setMessage("Section updated");
      cancelEditSectionName(sectionId);
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSection = async (sectionId) => {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/admin/sections/${sectionId}`, {
        method: "DELETE",
        token,
      });

      setMessage("Section deleted");
      setQuestionDrafts((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      setEditingQuestionBySection((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      cancelEditSectionName(sectionId);
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateQuestionDraft = (sectionId, patch) => {
    setQuestionDrafts((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || defaultQuestionDraft),
        ...patch,
      },
    }));
  };

  const resetSectionDraft = (sectionId) => {
    setQuestionDrafts((prev) => ({ ...prev, [sectionId]: defaultQuestionDraft }));
    setEditingQuestionBySection((prev) => ({ ...prev, [sectionId]: null }));
  };

  const startEditQuestion = (sectionId, question) => {
    setQuestionDrafts((prev) => ({
      ...prev,
      [sectionId]: {
        questionText: question.questionText,
        options: [...question.options],
        correctAnswer: question.correctAnswer,
      },
    }));
    setEditingQuestionBySection((prev) => ({ ...prev, [sectionId]: question._id }));
  };

  const saveQuestion = async (sectionId) => {
    const draft = questionDrafts[sectionId] || defaultQuestionDraft;
    const editingQuestionId = editingQuestionBySection[sectionId];

    if (!draft.questionText || draft.options.some((option) => !option)) {
      setError("Fill question text and all 4 options");
      return;
    }

    setError("");
    setMessage("");

    try {
      if (editingQuestionId) {
        await apiRequest(`/admin/questions/${editingQuestionId}`, {
          method: "PATCH",
          token,
          body: {
            questionText: draft.questionText,
            options: draft.options,
            correctAnswer: Number(draft.correctAnswer),
          },
        });
        setMessage("Question updated");
      } else {
        await apiRequest(`/admin/sections/${sectionId}/questions`, {
          method: "POST",
          token,
          body: {
            questionText: draft.questionText,
            options: draft.options,
            correctAnswer: Number(draft.correctAnswer),
          },
        });
        setMessage("Question added");
      }

      resetSectionDraft(sectionId);
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteQuestion = async (questionId) => {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/admin/questions/${questionId}`, {
        method: "DELETE",
        token,
      });

      if (previewQuestion?._id === questionId) {
        setPreviewQuestion(null);
        setPreviewExamId(null);
      }
      setMessage("Question deleted");
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePublish = async (exam) => {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/admin/exams/${exam._id}/publish`, {
        method: "PATCH",
        token,
        body: { published: !exam.published },
      });

      setMessage(exam.published ? "Exam unpublished" : "Exam published");
      await loadExams(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleExamExpanded = (examId) => {
    setExpandedExams((prev) => ({
      ...prev,
      [examId]: !prev[examId],
    }));
  };

  if (loading) {
    return (
      <main className="container">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card row space-between">
        <div>
          <h1 className="title">Admin Dashboard</h1>
          <p className="muted">Manage exams, sections, questions, publish state, and attempt reports.</p>
        </div>
        <button className="button secondary" onClick={handleLogout} type="button">
          Logout
        </button>
      </div>

      <form className="card stack" onSubmit={createExam}>
        <h2 className="title">Create Exam</h2>
        <input
          className="input"
          placeholder="Exam title"
          value={examForm.title}
          onChange={(event) => setExamForm((prev) => ({ ...prev, title: event.target.value }))}
          required
        />

        <div className="grid grid-2">
          <input
            className="input"
            type="datetime-local"
            placeholder="Exam date and time"
            value={examForm.scheduledAt}
            onChange={(event) => setExamForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
            required
          />

          <input
            className="input"
            type="number"
            min="1"
            placeholder="Duration in minutes"
            value={examForm.duration}
            onChange={(event) => setExamForm((prev) => ({ ...prev, duration: event.target.value }))}
            required
          />

          <input
            className="input"
            type="number"
            placeholder="Correct mark"
            value={examForm.correct}
            onChange={(event) => setExamForm((prev) => ({ ...prev, correct: event.target.value }))}
            required
          />
        </div>

        <input
          className="input"
          type="number"
          placeholder="Wrong mark"
          value={examForm.wrong}
          onChange={(event) => setExamForm((prev) => ({ ...prev, wrong: event.target.value }))}
          required
        />

        <button className="button" type="submit">
          Save Exam
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}

      <section className="grid">
        {exams.map((exam) => (
          <article className="card" key={exam._id}>
            {(() => {
              const isExpanded = Boolean(expandedExams[exam._id]);
              return (
                <>
            <div className="row space-between">
              <div>
                <h3 className="title">{exam.title}</h3>
                <p className="muted">
                  Duration: {exam.duration} min | Marking: +{exam.markingScheme.correct} / {exam.markingScheme.wrong}
                </p>
                <p className="muted">Scheduled: {exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleString() : "-"}</p>
              </div>

              <div className="row">
                <button className="button" onClick={() => togglePublish(exam)} type="button">
                  {exam.published ? "Unpublish" : "Publish"}
                </button>
                <button className="button outline" onClick={() => router.push(`/admin/results/${exam._id}`)} type="button">
                  View Results & Attempts
                </button>
                <button className="button outline" onClick={() => toggleExamExpanded(exam._id)} type="button">
                  {isExpanded ? "Show Less" : "Show More"}
                </button>
              </div>
            </div>

            {isExpanded ? (
              <>
            <div className="row" style={{ marginBottom: 12 }}>
              <input
                className="input"
                placeholder="New section name"
                value={sectionNames[exam._id] || ""}
                onChange={(event) =>
                  setSectionNames((prev) => ({
                    ...prev,
                    [exam._id]: event.target.value,
                  }))
                }
              />
              <button className="button" onClick={() => addSection(exam._id)} type="button">
                Add Section
              </button>
            </div>

            {exam.sections?.map((section) => {
              const draft = questionDrafts[section._id] || defaultQuestionDraft;
              const isEditing = Boolean(editingQuestionBySection[section._id]);
              const sectionQuestions = sortQuestions(section.questions || []);
              const isEditingSectionName = editingSectionNames[section._id] !== undefined;

              return (
                <div className="card" key={section._id}>
                  <div className="row space-between">
                    <h4 className="title" style={{ marginBottom: 0 }}>
                      {section.name} ({sectionQuestions.length} questions)
                    </h4>
                    <div className="row">
                      <button className="button outline" onClick={() => startEditSectionName(section)} type="button">
                        Edit Section
                      </button>
                      <button className="button danger" onClick={() => deleteSection(section._id)} type="button">
                        Delete Section
                      </button>
                    </div>
                  </div>

                  {isEditingSectionName ? (
                    <div className="row" style={{ marginTop: 10 }}>
                      <input
                        className="input"
                        placeholder="Section name"
                        value={editingSectionNames[section._id]}
                        onChange={(event) =>
                          setEditingSectionNames((prev) => ({
                            ...prev,
                            [section._id]: event.target.value,
                          }))
                        }
                      />
                      <button className="button" onClick={() => saveSectionName(section._id)} type="button">
                        Save Name
                      </button>
                      <button className="button outline" onClick={() => cancelEditSectionName(section._id)} type="button">
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  <div className="stack">
                    <textarea
                      className="textarea"
                      placeholder="Question text"
                      value={draft.questionText}
                      onChange={(event) =>
                        updateQuestionDraft(section._id, {
                          questionText: event.target.value,
                        })
                      }
                    />

                    {draft.options.map((option, index) => (
                      <input
                        key={index}
                        className="input"
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(event) => {
                          const nextOptions = [...draft.options];
                          nextOptions[index] = event.target.value;
                          updateQuestionDraft(section._id, { options: nextOptions });
                        }}
                      />
                    ))}

                    <select
                      className="select"
                      value={draft.correctAnswer}
                      onChange={(event) =>
                        updateQuestionDraft(section._id, {
                          correctAnswer: Number(event.target.value),
                        })
                      }
                    >
                      <option value={0}>Correct Option: 1</option>
                      <option value={1}>Correct Option: 2</option>
                      <option value={2}>Correct Option: 3</option>
                      <option value={3}>Correct Option: 4</option>
                    </select>

                    <div className="row">
                      <button className="button" onClick={() => saveQuestion(section._id)} type="button">
                        {isEditing ? "Update Question" : "Add Question"}
                      </button>
                      {isEditing ? (
                        <button className="button outline" onClick={() => resetSectionDraft(section._id)} type="button">
                          Cancel Edit
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <h5 className="title">Added Questions</h5>
                    <div className="question-list">
                      {sectionQuestions.length === 0 ? (
                        <p className="muted">No questions added yet.</p>
                      ) : (
                        sectionQuestions.map((question, index) => (
                          <div className="question-item" key={question._id}>
                            <p style={{ margin: 0, fontWeight: 600 }}>Q{index + 1}. {question.questionText}</p>
                            <p className="muted" style={{ marginBottom: 0 }}>
                              Correct: Option {question.correctAnswer + 1}
                            </p>
                            <div className="question-actions">
                              <button
                                className="button outline"
                                onClick={() => {
                                  setPreviewQuestion(question);
                                  setPreviewExamId(exam._id);
                                }}
                                type="button"
                              >
                                Preview
                              </button>
                              <button className="button secondary" onClick={() => startEditQuestion(section._id, question)} type="button">
                                Edit
                              </button>
                              <button className="button danger" onClick={() => deleteQuestion(question._id)} type="button">
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {previewQuestion && previewExamId === exam._id ? (
              <div className="card">
                <h4 className="title">Student Preview</h4>
                <div className="preview-box">
                  <p style={{ marginTop: 0, fontWeight: 600 }}>{previewQuestion.questionText}</p>
                  {(previewQuestion.options || []).map((option, optionIndex) => (
                    <label className="question-option" key={optionIndex}>
                      <input disabled name={`preview-${previewQuestion._id}`} type="radio" /> {option}
                    </label>
                  ))}
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Correct option: {previewQuestion.correctAnswer + 1}
                  </p>
                </div>
              </div>
            ) : null}
              </>
            ) : null}
                </>
              );
            })()}
          </article>
        ))}
      </section>
    </main>
  );
}
