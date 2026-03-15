const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Section = require("../models/Section");

const examRuntimeCache = new Map();

const buildExamRuntimePayload = async (examId) => {
  const exam = await Exam.findById(examId)
    .select("_id title duration scheduledAt markingScheme published")
    .lean();

  if (!exam) {
    return null;
  }

  const sections = await Section.find({ examId: exam._id })
    .sort({ order: 1, createdAt: 1 })
    .select("_id examId name order")
    .lean();

  const questions = await Question.find({ examId: exam._id })
    .sort({ order: 1, createdAt: 1 })
    .select("_id examId sectionId questionText options order imageUrl")
    .lean();

  const sectionNameById = new Map(sections.map((section) => [String(section._id), section.name]));

  return {
    exam: {
      _id: exam._id,
      title: exam.title,
      duration: exam.duration,
      scheduledAt: exam.scheduledAt,
      markingScheme: exam.markingScheme,
      published: exam.published,
    },
    sections: sections.map((section) => ({
      _id: section._id,
      examId: section.examId,
      name: section.name,
      order: section.order,
    })),
    questions: questions.map((question) => ({
      _id: question._id,
      examId: question.examId,
      sectionId: question.sectionId,
      sectionName: sectionNameById.get(String(question.sectionId)) || "Section",
      questionText: question.questionText,
      imageUrl: question.imageUrl || "",
      options: question.options,
      order: question.order,
    })),
  };
};

const getCachedExamRuntime = async (examId, { forceRefresh = false } = {}) => {
  const cacheKey = String(examId);

  if (!forceRefresh && examRuntimeCache.has(cacheKey)) {
    return examRuntimeCache.get(cacheKey);
  }

  const payload = await buildExamRuntimePayload(examId);
  if (!payload) {
    examRuntimeCache.delete(cacheKey);
    return null;
  }

  examRuntimeCache.set(cacheKey, payload);
  return payload;
};

const warmExamRuntimeCache = async (examId) => getCachedExamRuntime(examId, { forceRefresh: true });

const invalidateExamRuntimeCache = (examId) => {
  if (!examId) {
    return;
  }
  examRuntimeCache.delete(String(examId));
};

module.exports = {
  getCachedExamRuntime,
  warmExamRuntimeCache,
  invalidateExamRuntimeCache,
};
