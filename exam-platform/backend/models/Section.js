const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  { timestamps: true }
);

sectionSchema.index({ examId: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model("Section", sectionSchema);
