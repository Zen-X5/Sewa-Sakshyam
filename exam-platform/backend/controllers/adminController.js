const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Section = require("../models/Section");
const cloudinary = require("../lib/cloudinary");
const {
  scheduleExamStartBroadcast,
  cancelExamStartBroadcast,
} = require("../services/examStartRealtimeService");

const destroyCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (_) {}
};

const buildExamPayload = async (exam) => {
  const sections = await Section.find({ examId: exam._id }).sort({ order: 1, createdAt: 1 }).lean();
  const questions = await Question.find({ examId: exam._id }).sort({ order: 1, createdAt: 1 }).lean();

  const questionsBySection = sections.reduce((acc, section) => {
    acc[String(section._id)] = [];
    return acc;
  }, {});

  for (const question of questions) {
    const key = String(question.sectionId);
    if (!questionsBySection[key]) {
      questionsBySection[key] = [];
    }
    questionsBySection[key].push(question);
  }

  return {
    ...exam.toObject(),
    sections: sections.map((section) => ({
      ...section,
      questions: questionsBySection[String(section._id)] || [],
    })),
  };
};

const createExam = async (req, res) => {
  try {
    const { title, duration, markingScheme, scheduledAt } = req.body;

    if (!title || !duration || !scheduledAt) {
      return res.status(400).json({ message: "Title, duration and scheduled date-time are required" });
    }

    const parsedSchedule = new Date(scheduledAt);
    if (Number.isNaN(parsedSchedule.getTime())) {
      return res.status(400).json({ message: "Invalid scheduled date-time" });
    }

    const exam = await Exam.create({
      title,
      duration,
      scheduledAt: parsedSchedule,
      markingScheme: {
        correct: markingScheme?.correct ?? 4,
        wrong: markingScheme?.wrong ?? -1,
        unattempted: markingScheme?.unattempted ?? 0,
      },
      createdBy: req.user._id,
      published: false,
    });

    return res.status(201).json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create exam" });
  }
};

const getAdminExams = async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    const payload = await Promise.all(exams.map((exam) => buildExamPayload(exam)));
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch exams" });
  }
};

const togglePublish = async (req, res) => {
  try {
    const { examId } = req.params;
    const { published } = req.body;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    exam.published = Boolean(published);
    await exam.save();

    return res.json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update publish status" });
  }
};

const addSection = async (req, res) => {
  try {
    const { examId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const sectionCount = await Section.countDocuments({ examId });

    const section = await Section.create({
      examId,
      name,
      order: sectionCount + 1,
    });

    return res.status(201).json(section);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add section" });
  }
};

const updateSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const exam = await Exam.findOne({ _id: section.examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(403).json({ message: "You cannot modify this section" });
    }

    section.name = name.trim();
    await section.save();

    return res.json(section);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update section" });
  }
};

const deleteSection = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const exam = await Exam.findOne({ _id: section.examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(403).json({ message: "You cannot delete this section" });
    }

    await Question.deleteMany({ sectionId: section._id });
    await Section.deleteOne({ _id: section._id });

    return res.json({ message: "Section and related questions deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete section" });
  }
};

const uploadQuestionImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "exam-questions", resource_type: "image" },
        (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.json({ imageUrl: result.secure_url, imagePublicId: result.public_id });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to upload image" });
  }
};

const addQuestion = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { questionText, options, correctAnswer, imageUrl, imagePublicId } = req.body;

    if (!questionText || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ message: "Question text and exactly 4 options are required" });
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ message: "Correct answer must be between 0 and 3" });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const exam = await Exam.findOne({ _id: section.examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(403).json({ message: "You cannot modify this section" });
    }

    const questionCount = await Question.countDocuments({ sectionId });

    const question = await Question.create({
      examId: exam._id,
      sectionId,
      questionText,
      options,
      correctAnswer,
      imageUrl: imageUrl || "",
      imagePublicId: imagePublicId || "",
      order: questionCount + 1,
    });

    return res.status(201).json(question);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add question" });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { questionText, options, correctAnswer, imageUrl, imagePublicId } = req.body;

    if (!questionText || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ message: "Question text and exactly 4 options are required" });
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      return res.status(400).json({ message: "Correct answer must be between 0 and 3" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const exam = await Exam.findOne({ _id: question.examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(403).json({ message: "You cannot modify this question" });
    }

    // If image changed or removed, destroy old Cloudinary asset
    const newPublicId = imagePublicId || "";
    if (question.imagePublicId && question.imagePublicId !== newPublicId) {
      await destroyCloudinaryImage(question.imagePublicId);
    }

    question.questionText = questionText;
    question.options = options;
    question.correctAnswer = Number(correctAnswer);
    question.imageUrl = imageUrl || "";
    question.imagePublicId = newPublicId;
    await question.save();

    return res.json(question);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update question" });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const exam = await Exam.findOne({ _id: question.examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(403).json({ message: "You cannot delete this question" });
    }

    await destroyCloudinaryImage(question.imagePublicId);
    await Question.deleteOne({ _id: questionId });

    return res.json({ message: "Question deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete question" });
  }
};

const deleteExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const sections = await Section.find({ examId: exam._id });
    const sectionIds = sections.map((s) => s._id);

    // Destroy Cloudinary images for all questions in this exam
    const questionsWithImages = await Question.find(
      { sectionId: { $in: sectionIds }, imagePublicId: { $exists: true, $ne: "" } },
      { imagePublicId: 1 }
    ).lean();
    for (const q of questionsWithImages) {
      await destroyCloudinaryImage(q.imagePublicId);
    }

    await Question.deleteMany({ sectionId: { $in: sectionIds } });
    await Section.deleteMany({ examId: exam._id });
    await Exam.deleteOne({ _id: exam._id });

    return res.json({ message: "Exam deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete exam" });
  }
};

const updateExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { title, duration, scheduledAt, markingScheme } = req.body;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    let hasUpdate = false;

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ message: "Exam title is required" });
      }
      exam.title = String(title).trim();
      hasUpdate = true;
    }

    if (duration !== undefined) {
      const parsedDuration = Number(duration);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 1) {
        return res.status(400).json({ message: "Duration must be a positive number" });
      }
      exam.duration = parsedDuration;
      hasUpdate = true;
    }

    if (scheduledAt !== undefined) {
      const parsedSchedule = new Date(scheduledAt);
      if (Number.isNaN(parsedSchedule.getTime())) {
        return res.status(400).json({ message: "Invalid scheduled date-time" });
      }
      exam.scheduledAt = parsedSchedule;
      hasUpdate = true;

      cancelExamStartBroadcast(exam._id);
      if (exam.published) {
        scheduleExamStartBroadcast(exam._id, parsedSchedule);
      }
    }

    if (markingScheme && typeof markingScheme === "object") {
      if (markingScheme.correct !== undefined) {
        const parsedCorrect = Number(markingScheme.correct);
        if (!Number.isFinite(parsedCorrect)) {
          return res.status(400).json({ message: "Marks for correct answer must be a number" });
        }
        exam.markingScheme.correct = parsedCorrect;
        hasUpdate = true;
      }

      if (markingScheme.wrong !== undefined) {
        const parsedWrong = Number(markingScheme.wrong);
        if (!Number.isFinite(parsedWrong)) {
          return res.status(400).json({ message: "Marks for wrong answer must be a number" });
        }
        exam.markingScheme.wrong = parsedWrong;
        hasUpdate = true;
      }
    }

    if (!hasUpdate) {
      return res.status(400).json({ message: "No exam settings provided to update" });
    }

    await exam.save();

    return res.json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update exam" });
  }
};

const getExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const attempts = await Attempt.find({ examId, submitted: true })
      .populate("userId", "name email")
      .sort({ endTime: -1 })
      .lean();

    return res.json(attempts);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch attempts" });
  }
};

const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id }).lean();
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const sections = await Section.find({ examId }).sort({ order: 1, createdAt: 1 }).lean();
    const questions = await Question.find({ examId }).lean();

    const attempts = await Attempt.find({ examId, submitted: true })
      .populate("userId", "name email")
      .sort({ score: -1, endTime: 1 })
      .lean();

    const sectionTemplate = sections.map((section) => ({
      sectionId: String(section._id),
      sectionName: section.name,
      marks: 0,
      correct: 0,
      wrong: 0,
      unattempted: 0,
      totalQuestions: 0,
    }));

    const results = attempts.map((attempt) => {
      const sectionMap = new Map(sectionTemplate.map((item) => [item.sectionId, { ...item }]));
      const answerMap = new Map(attempt.answers.map((answer) => [String(answer.questionId), answer.selectedOption]));

      for (const question of questions) {
        const sectionKey = String(question.sectionId);
        if (!sectionMap.has(sectionKey)) {
          sectionMap.set(sectionKey, {
            sectionId: sectionKey,
            sectionName: "Unknown Section",
            marks: 0,
            correct: 0,
            wrong: 0,
            unattempted: 0,
            totalQuestions: 0,
          });
        }

        const sectionStats = sectionMap.get(sectionKey);
        sectionStats.totalQuestions += 1;

        const selectedOption = answerMap.get(String(question._id));

        if (selectedOption === undefined) {
          sectionStats.unattempted += 1;
          sectionStats.marks += exam.markingScheme.unattempted ?? 0;
        } else if (selectedOption === question.correctAnswer) {
          sectionStats.correct += 1;
          sectionStats.marks += exam.markingScheme.correct;
        } else {
          sectionStats.wrong += 1;
          sectionStats.marks += exam.markingScheme.wrong;
        }
      }

      return {
        attemptId: String(attempt._id),
        studentName: attempt.userId?.name || "-",
        studentEmail: attempt.userId?.email || "-",
        totalScore: attempt.score,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unattemptedCount: attempt.unattemptedCount,
        submittedReason: attempt.submittedReason,
        submittedAt: attempt.endTime,
        sectionScores: sections.map((section) => sectionMap.get(String(section._id))),
      };
    });

    return res.json({
      exam: {
        examId: String(exam._id),
        title: exam.title,
        scheduledAt: exam.scheduledAt,
      },
      sections: sections.map((section) => ({
        sectionId: String(section._id),
        sectionName: section.name,
      })),
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch exam results" });
  }
};

module.exports = {
  createExam,
  getAdminExams,
  togglePublish,
  updateExam,
  deleteExam,
  addSection,
  updateSection,
  deleteSection,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  uploadQuestionImage,
  getExamAttempts,
  getExamResults,
};
