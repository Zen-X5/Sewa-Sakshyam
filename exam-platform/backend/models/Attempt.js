const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOption: {
      type: Number,
      min: 0,
      max: 3,
      required: true,
    },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    wrongCount: {
      type: Number,
      default: 0,
    },
    unattemptedCount: {
      type: Number,
      default: 0,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    submittedReason: {
      type: String,
      enum: ["manual", "timer", "cheating"],
    },
    submitted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

attemptSchema.index({ userId: 1, examId: 1, submitted: 1 });
attemptSchema.index({ examId: 1, submitted: 1, endTime: -1 });

module.exports = mongoose.model("Attempt", attemptSchema);
