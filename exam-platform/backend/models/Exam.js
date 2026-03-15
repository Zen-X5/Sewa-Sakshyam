const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    markingScheme: {
      correct: { type: Number, default: 4 },
      wrong: { type: Number, default: -1 },
      unattempted: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

examSchema.index({ published: 1, scheduledAt: 1 });
examSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Exam", examSchema);
