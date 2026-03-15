const express = require("express");
const {
  getPublishedExams,
  getExamInstructions,
  getExamPreload,
  joinExamWithVerifiedEmail,
  startExamAttempt,
  getAttemptState,
  saveAttemptAnswersBatch,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
} = require("../controllers/studentController");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/exams", getPublishedExams);
router.get("/exams/:examId/instructions", getExamInstructions);
router.post("/exams/:examId/join", joinExamWithVerifiedEmail);

router.use(protect, authorize("student"));

router.get("/exams/:examId/preload", getExamPreload);

router.post("/exams/:examId/start", startExamAttempt);

router.get("/attempts/:attemptId", getAttemptState);
router.post("/attempts/:attemptId/save", saveAttemptAnswersBatch);
router.patch("/attempts/:attemptId/answer", saveAnswer);
router.post("/attempts/:attemptId/submit", submitAttempt);
router.get("/attempts/:attemptId/result", getAttemptResult);

module.exports = router;
