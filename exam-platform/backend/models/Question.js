const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 4,
        message: "Each question must contain exactly 4 options",
      },
      required: true,
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  { timestamps: true }
);

questionSchema.index({ examId: 1, order: 1, createdAt: 1 });
questionSchema.index({ sectionId: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model("Question", questionSchema);

