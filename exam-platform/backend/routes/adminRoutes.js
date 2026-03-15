const express = require("express");
const {
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
  getExamAttempts,
  getExamResults,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/exams", getAdminExams);
router.post("/exams", createExam);
router.patch("/exams/:examId/publish", togglePublish);
router.patch("/exams/:examId", updateExam);
router.delete("/exams/:examId", deleteExam);
router.post("/exams/:examId/sections", addSection);
router.patch("/sections/:sectionId", updateSection);
router.delete("/sections/:sectionId", deleteSection);
router.post("/sections/:sectionId/questions", addQuestion);
router.patch("/questions/:questionId", updateQuestion);
router.delete("/questions/:questionId", deleteQuestion);
router.get("/exams/:examId/attempts", getExamAttempts);
router.get("/exams/:examId/results", getExamResults);

module.exports = router;
