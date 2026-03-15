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
      <div className="adm-shell">
        <div className="adm-loading">Loading dashboard...</div>
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
          <button className="adm-btn adm-btn-ghost" onClick={handleLogout} type="button">Logout</button>
        </div>
      </header>

      <main className="adm-main">

        {/* ── PAGE TITLE ── */}
        <div className="adm-page-title">
          <div>
            <h1>Dashboard</h1>
            <p>Manage exams, sections, questions and results.</p>
          </div>
        </div>

        {error  ? <div className="adm-alert adm-alert-error">{error}</div>   : null}
        {message ? <div className="adm-alert adm-alert-success">{message}</div> : null}

        {/* ── CREATE EXAM FORM ── */}
        <section className="adm-card">
          <div className="adm-card-header">Create New Exam</div>
          <form className="adm-card-body stack" onSubmit={createExam}>
            <div className="adm-field">
              <label className="adm-label">Exam Title</label>
              <input className="input" placeholder="e.g. JEE Mock Test 1" value={examForm.title}
                onChange={(e) => setExamForm((p) => ({ ...p, title: e.target.value }))} required />
            </div>
            <div className="adm-form-grid">
              <div className="adm-field">
                <label className="adm-label">Scheduled Date &amp; Time</label>
                <input className="input" type="datetime-local" value={examForm.scheduledAt}
                  onChange={(e) => setExamForm((p) => ({ ...p, scheduledAt: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Duration (minutes)</label>
                <input className="input" type="number" min="1" placeholder="180" value={examForm.duration}
                  onChange={(e) => setExamForm((p) => ({ ...p, duration: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Marks for Correct</label>
                <input className="input" type="number" placeholder="4" value={examForm.correct}
                  onChange={(e) => setExamForm((p) => ({ ...p, correct: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Marks for Wrong</label>
                <input className="input" type="number" placeholder="-1" value={examForm.wrong}
                  onChange={(e) => setExamForm((p) => ({ ...p, wrong: e.target.value }))} required />
              </div>
            </div>
            <div>
              <button className="adm-btn adm-btn-primary" type="submit">+ Create Exam</button>
            </div>
          </form>
        </section>

        {/* ── EXAM LIST ── */}
        <section>
          <h2 className="adm-section-heading">All Exams ({exams.length})</h2>
          {exams.length === 0 && <p className="adm-empty">No exams created yet.</p>}

          {exams.map((exam) => {
            const isExpanded = Boolean(expandedExams[exam._id]);
            const totalQ = exam.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0;

            return (
              <div className="adm-exam-card" key={exam._id}>

                {/* Exam header row */}
                <div className="adm-exam-header">
                  <div className="adm-exam-meta">
                    <div className="adm-exam-title-row">
                      <h3 className="adm-exam-title">{exam.title}</h3>
                      <span className={`adm-badge ${exam.published ? "adm-badge-published" : "adm-badge-draft"}`}>
                        {exam.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="adm-exam-chips">
                      <span className="adm-chip">⏱ {exam.duration} min</span>
                      <span className="adm-chip">+{exam.markingScheme.correct} / {exam.markingScheme.wrong}</span>
                      <span className="adm-chip">📅 {exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleString() : "—"}</span>
                      <span className="adm-chip">{exam.sections?.length || 0} sections · {totalQ} questions</span>
                    </div>
                  </div>
                  <div className="adm-exam-actions">
                    <button className={`adm-btn ${exam.published ? "adm-btn-warn" : "adm-btn-primary"}`}
                      onClick={() => togglePublish(exam)} type="button">
                      {exam.published ? "Unpublish" : "Publish"}
                    </button>
                    <button className="adm-btn adm-btn-outline"
                      onClick={() => router.push(`/admin/results/${exam._id}`)} type="button">
                      Results &amp; Attempts
                    </button>
                    <button className="adm-btn adm-btn-ghost adm-expand-btn"
                      onClick={() => toggleExamExpanded(exam._id)} type="button">
                      {isExpanded ? "▲ Collapse" : "▼ Expand"}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="adm-exam-body">

                    {/* Add section row */}
                    <div className="adm-add-section-row">
                      <input className="input" placeholder="New section name (e.g. Physics)"
                        value={sectionNames[exam._id] || ""}
                        onChange={(e) => setSectionNames((p) => ({ ...p, [exam._id]: e.target.value }))} />
                      <button className="adm-btn adm-btn-primary" onClick={() => addSection(exam._id)} type="button">
                        + Add Section
                      </button>
                    </div>

                    {/* Sections */}
                    {exam.sections?.map((section) => {
                      const draft = questionDrafts[section._id] || defaultQuestionDraft;
                      const isEditing = Boolean(editingQuestionBySection[section._id]);
                      const sectionQuestions = sortQuestions(section.questions || []);
                      const isEditingSectionName = editingSectionNames[section._id] !== undefined;

                      return (
                        <div className="adm-section-card" key={section._id}>
                          {/* Section header */}
                          <div className="adm-section-header">
                            <div>
                              {isEditingSectionName ? (
                                <div className="row" style={{ gap: 8 }}>
                                  <input className="input" style={{ maxWidth: 260 }}
                                    value={editingSectionNames[section._id]}
                                    onChange={(e) => setEditingSectionNames((p) => ({ ...p, [section._id]: e.target.value }))} />
                                  <button className="adm-btn adm-btn-primary" onClick={() => saveSectionName(section._id)} type="button">Save</button>
                                  <button className="adm-btn adm-btn-ghost" onClick={() => cancelEditSectionName(section._id)} type="button">Cancel</button>
                                </div>
                              ) : (
                                <h4 className="adm-section-title">{section.name} <span className="adm-section-count">{sectionQuestions.length} questions</span></h4>
                              )}
                            </div>
                            <div className="row" style={{ gap: 6 }}>
                              {!isEditingSectionName && (
                                <button className="adm-btn adm-btn-ghost" onClick={() => startEditSectionName(section)} type="button">Rename</button>
                              )}
                              <button className="adm-btn adm-btn-danger" onClick={() => deleteSection(section._id)} type="button">Delete</button>
                            </div>
                          </div>

                          {/* Question editor */}
                          <div className="adm-q-editor">
                            <div className="adm-field">
                              <label className="adm-label">{isEditing ? "Edit Question" : "New Question"}</label>
                              <textarea className="textarea" placeholder="Enter question text..."
                                value={draft.questionText}
                                onChange={(e) => updateQuestionDraft(section._id, { questionText: e.target.value })} />
                            </div>
                            <div className="adm-options-grid">
                              {draft.options.map((opt, idx) => (
                                <input key={idx} className="input" placeholder={`Option ${idx + 1}`} value={opt}
                                  onChange={(e) => {
                                    const next = [...draft.options];
                                    next[idx] = e.target.value;
                                    updateQuestionDraft(section._id, { options: next });
                                  }} />
                              ))}
                            </div>
                            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                              <div className="adm-field" style={{ flex: "0 0 auto" }}>
                                <label className="adm-label">Correct Option</label>
                                <select className="select" style={{ width: 160 }} value={draft.correctAnswer}
                                  onChange={(e) => updateQuestionDraft(section._id, { correctAnswer: Number(e.target.value) })}>
                                  <option value={0}>Option 1</option>
                                  <option value={1}>Option 2</option>
                                  <option value={2}>Option 3</option>
                                  <option value={3}>Option 4</option>
                                </select>
                              </div>
                              <div className="row" style={{ alignSelf: "flex-end", gap: 8 }}>
                                <button className="adm-btn adm-btn-primary" onClick={() => saveQuestion(section._id)} type="button">
                                  {isEditing ? "Update Question" : "Add Question"}
                                </button>
                                {isEditing && (
                                  <button className="adm-btn adm-btn-ghost" onClick={() => resetSectionDraft(section._id)} type="button">Cancel</button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Question list */}
                          {sectionQuestions.length > 0 && (
                            <div className="adm-q-list">
                              <p className="adm-label" style={{ marginBottom: 8 }}>Added Questions</p>
                              <div className="question-list">
                                {sectionQuestions.map((q, idx) => (
                                  <div className="adm-q-item" key={q._id}>
                                    <div className="adm-q-text">Q{idx + 1}. {q.questionText}</div>
                                    <div className="adm-q-correct">Correct: Option {q.correctAnswer + 1}</div>
                                    <div className="question-actions">
                                      <button className="adm-btn adm-btn-ghost adm-btn-sm"
                                        onClick={() => { setPreviewQuestion(q); setPreviewExamId(exam._id); }} type="button">Preview</button>
                                      <button className="adm-btn adm-btn-outline adm-btn-sm"
                                        onClick={() => startEditQuestion(section._id, q)} type="button">Edit</button>
                                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                                        onClick={() => deleteQuestion(q._id)} type="button">Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Preview box */}
                          {previewQuestion && previewExamId === exam._id && previewQuestion.sectionId === section._id && (
                            <div className="adm-preview-wrap">
                              <div className="adm-preview-label">Student Preview</div>
                              <div className="preview-box">
                                <p style={{ marginTop: 0, fontWeight: 600 }}>{previewQuestion.questionText}</p>
                                {previewQuestion.options.map((opt, oi) => (
                                  <label className="question-option" key={oi}>
                                    <input disabled name={`prev-${previewQuestion._id}`} type="radio" /> {opt}
                                  </label>
                                ))}
                                <p className="muted" style={{ marginBottom: 0 }}>Correct: Option {previewQuestion.correctAnswer + 1}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Preview for exam-level (cross-section preview fallback) */}
                    {previewQuestion && previewExamId === exam._id && !exam.sections?.some(s => s._id === previewQuestion.sectionId) && (
                      <div className="adm-preview-wrap">
                        <div className="adm-preview-label">Student Preview</div>
                        <div className="preview-box">
                          <p style={{ marginTop: 0, fontWeight: 600 }}>{previewQuestion.questionText}</p>
                          {previewQuestion.options.map((opt, oi) => (
                            <label className="question-option" key={oi}>
                              <input disabled name={`prev-${previewQuestion._id}`} type="radio" /> {opt}
                            </label>
                          ))}
                          <p className="muted" style={{ marginBottom: 0 }}>Correct: Option {previewQuestion.correctAnswer + 1}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
