const jwt = require("jsonwebtoken");
const Attempt = require("../models/Attempt");
const EmailOtp = require("../models/EmailOtp");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Section = require("../models/Section");
const User = require("../models/User");
const { evaluateAttempt } = require("../services/scoringService");

const otpVerifiedGraceMinutes = Number(process.env.OTP_VERIFIED_GRACE_MINUTES || 30);
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const isAttemptExpired = (attemptStartTime, durationMinutes) => {
  const elapsedMs = Date.now() - new Date(attemptStartTime).getTime();
  return elapsedMs >= durationMinutes * 60 * 1000;
};

const finalizeAttempt = async (attempt, reason = "manual") => {
  const exam = await Exam.findById(attempt.examId);
  const questions = await Question.find({ examId: attempt.examId });

  const stats = evaluateAttempt({
    questions,
    answers: attempt.answers,
    markingScheme: exam.markingScheme,
  });

  attempt.score = stats.score;
  attempt.correctCount = stats.correctCount;
  attempt.wrongCount = stats.wrongCount;
  attempt.unattemptedCount = stats.unattemptedCount;
  attempt.submitted = true;
  attempt.submittedReason = reason;
  attempt.endTime = new Date();

  await attempt.save();

  return {
    attemptId: attempt._id,
    examId: attempt.examId,
    score: attempt.score,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    unattemptedCount: attempt.unattemptedCount,
    submittedReason: attempt.submittedReason,
    startTime: attempt.startTime,
    endTime: attempt.endTime,
  };
};

const getPublishedExams = async (req, res) => {
  try {
    const exams = await Exam.find({ published: true }).sort({ scheduledAt: 1, createdAt: -1 }).lean();
    const examIds = exams.map((exam) => exam._id);

    const sections = await Section.find({ examId: { $in: examIds } }).lean();
    const questions = await Question.find({ examId: { $in: examIds } }).lean();

    const sectionCountMap = new Map();
    const questionCountMap = new Map();

    for (const section of sections) {
      const key = String(section.examId);
      sectionCountMap.set(key, (sectionCountMap.get(key) || 0) + 1);
    }

    for (const question of questions) {
      const key = String(question.examId);
      questionCountMap.set(key, (questionCountMap.get(key) || 0) + 1);
    }

    return res.json(
      exams.map((exam) => ({
        ...exam,
        sectionCount: sectionCountMap.get(String(exam._id)) || 0,
        questionCount: questionCountMap.get(String(exam._id)) || 0,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load exams" });
  }
};

const getExamInstructions = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ _id: examId, published: true }).lean();

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const sections = await Section.find({ examId }).sort({ order: 1, createdAt: 1 }).lean();
    const questions = await Question.find({ examId }).lean();

    const sectionQuestionCount = new Map();
    for (const question of questions) {
      const key = String(question.sectionId);
      sectionQuestionCount.set(key, (sectionQuestionCount.get(key) || 0) + 1);
    }

    return res.json({
      ...exam,
      totalQuestions: questions.length,
      sections: sections.map((section) => ({
        ...section,
        questionCount: sectionQuestionCount.get(String(section._id)) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch instructions" });
  }
};

const joinExamWithVerifiedEmail = async (req, res) => {
  try {
    const { examId } = req.params;
    const { name, email, instituteName } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !instituteName) {
      return res.status(400).json({ message: "Name, email and institute name are required" });
    }

    const exam = await Exam.findOne({ _id: examId, published: true }).lean();
    if (!exam) {
      return res.status(404).json({ message: "Exam not found or not published" });
    }

    const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });
    if (!otpRecord || !otpRecord.verifiedAt) {
      return res.status(400).json({ message: "Verify email via OTP before starting exam" });
    }

    const verificationAgeMs = Date.now() - new Date(otpRecord.verifiedAt).getTime();
    if (verificationAgeMs > otpVerifiedGraceMinutes * 60 * 1000) {
      return res.status(400).json({ message: "Email verification expired. Please verify again" });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.role !== "student") {
      return res.status(409).json({ message: "This email belongs to a non-student account" });
    }

    if (!user) {
      user = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        role: "student",
        instituteName: String(instituteName).trim(),
        emailVerified: true,
      });
    } else {
      user.name = String(name).trim();
      user.instituteName = String(instituteName).trim();
      user.emailVerified = true;
      await user.save();
    }

    await EmailOtp.deleteOne({ email: normalizedEmail });

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        instituteName: user.instituteName,
        emailVerified: user.emailVerified,
      },
      exam: {
        _id: exam._id,
        title: exam.title,
        scheduledAt: exam.scheduledAt,
        duration: exam.duration,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to start exam onboarding" });
  }
};

const startExamAttempt = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, published: true });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found or not published" });
    }

    if (exam.scheduledAt && new Date() < new Date(exam.scheduledAt)) {
      return res.status(403).json({
        message: "Exam has not started yet",
        scheduledAt: exam.scheduledAt,
      });
    }

    const existingAttempt = await Attempt.findOne({
      userId: req.user._id,
      examId,
      submitted: false,
    });

    if (existingAttempt) {
      return res.json(existingAttempt);
    }

    const attempt = await Attempt.create({
      userId: req.user._id,
      examId,
      startTime: new Date(),
      submitted: false,
      answers: [],
    });

    return res.status(201).json(attempt);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to start exam" });
  }
};

const getAttemptState = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findOne({ _id: attemptId, userId: req.user._id }).lean();
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.submitted) {
      return res.status(409).json({ message: "Attempt already submitted", attempt });
    }

    const exam = await Exam.findById(attempt.examId).lean();
    const sections = await Section.find({ examId: attempt.examId }).sort({ order: 1, createdAt: 1 }).lean();
    const questions = await Question.find({ examId: attempt.examId }).sort({ order: 1, createdAt: 1 }).lean();

    const sectionMap = new Map(sections.map((section) => [String(section._id), section.name]));
    const answersMap = attempt.answers.reduce((acc, answer) => {
      acc[String(answer.questionId)] = answer.selectedOption;
      return acc;
    }, {});

    return res.json({
      attemptId: attempt._id,
      startTime: attempt.startTime,
      exam: {
        _id: exam._id,
        title: exam.title,
        duration: exam.duration,
        scheduledAt: exam.scheduledAt,
        markingScheme: exam.markingScheme,
      },
      sections,
      questions: questions.map((question) => ({
        _id: question._id,
        sectionId: question.sectionId,
        sectionName: sectionMap.get(String(question.sectionId)) || "Section",
        questionText: question.questionText,
        options: question.options,
        order: question.order,
      })),
      answers: answersMap,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load attempt" });
  }
};

const saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedOption } = req.body;

    if (!questionId || selectedOption === undefined) {
      return res.status(400).json({ message: "questionId and selectedOption are required" });
    }

    if (selectedOption < 0 || selectedOption > 3) {
      return res.status(400).json({ message: "selectedOption must be between 0 and 3" });
    }

    const attempt = await Attempt.findOne({ _id: attemptId, userId: req.user._id });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.submitted) {
      return res.status(409).json({ message: "Attempt already submitted" });
    }

    const exam = await Exam.findById(attempt.examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (isAttemptExpired(attempt.startTime, exam.duration)) {
      const result = await finalizeAttempt(attempt, "timer");
      return res.status(409).json({ message: "Time is over. Attempt submitted", submitted: true, result });
    }

    const question = await Question.findOne({ _id: questionId, examId: attempt.examId });
    if (!question) {
      return res.status(404).json({ message: "Question not found for this exam" });
    }

    const existingAnswerIndex = attempt.answers.findIndex(
      (answer) => String(answer.questionId) === String(questionId)
    );

    if (existingAnswerIndex >= 0) {
      attempt.answers[existingAnswerIndex].selectedOption = selectedOption;
    } else {
      attempt.answers.push({ questionId, selectedOption });
    }

    await attempt.save();

    return res.json({
      saved: true,
      answerCount: attempt.answers.length,
      updatedAt: attempt.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save answer" });
  }
};

const submitAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const reason = req.body.reason || "manual";

    const attempt = await Attempt.findOne({ _id: attemptId, userId: req.user._id });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.submitted) {
      return res.json({
        attemptId: attempt._id,
        score: attempt.score,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unattemptedCount: attempt.unattemptedCount,
        submittedReason: attempt.submittedReason,
      });
    }

    const result = await finalizeAttempt(attempt, reason);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to submit attempt" });
  }
};

const getAttemptResult = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findOne({ _id: attemptId, userId: req.user._id }).lean();
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (!attempt.submitted) {
      return res.status(409).json({ message: "Attempt not submitted yet" });
    }

    const exam = await Exam.findById(attempt.examId).lean();
    const sections = await Section.find({ examId: attempt.examId }).lean();
    const questions = await Question.find({ examId: attempt.examId }).lean();

    const sectionStats = new Map(
      sections.map((section) => [
        String(section._id),
        {
          sectionId: section._id,
          sectionName: section.name,
          correct: 0,
          wrong: 0,
          unattempted: 0,
          total: 0,
        },
      ])
    );

    const answerMap = new Map(attempt.answers.map((answer) => [String(answer.questionId), answer.selectedOption]));

    for (const question of questions) {
      const key = String(question.sectionId);
      const stat = sectionStats.get(key);
      if (!stat) {
        continue;
      }

      stat.total += 1;
      const selectedOption = answerMap.get(String(question._id));

      if (selectedOption === undefined) {
        stat.unattempted += 1;
      } else if (selectedOption === question.correctAnswer) {
        stat.correct += 1;
      } else {
        stat.wrong += 1;
      }
    }

    return res.json({
      attemptId: attempt._id,
      examTitle: exam.title,
      score: attempt.score,
      markingScheme: exam.markingScheme,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      unattemptedCount: attempt.unattemptedCount,
      submittedReason: attempt.submittedReason,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      sectionStats: Array.from(sectionStats.values()),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch result" });
  }
};

module.exports = {
  getPublishedExams,
  getExamInstructions,
  joinExamWithVerifiedEmail,
  startExamAttempt,
  getAttemptState,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
};
