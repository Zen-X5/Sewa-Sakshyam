const { getIO } = require("../lib/socket");

const scheduledExamTimers = new Map();

const emitExamStarted = (examId, startedAt) => {
  const io = getIO();
  if (!io) {
    return;
  }

  io.to(`exam:${examId}`).emit("exam-started", {
    examId: String(examId),
    startedAt: new Date(startedAt || Date.now()).toISOString(),
  });
};

const cancelExamStartBroadcast = (examId) => {
  const key = String(examId);
  const timer = scheduledExamTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    scheduledExamTimers.delete(key);
  }
};

const scheduleExamStartBroadcast = (examId, scheduledAt) => {
  const key = String(examId);
  const startTimestamp = new Date(scheduledAt).getTime();

  if (!Number.isFinite(startTimestamp)) {
    return;
  }

  const delayMs = startTimestamp - Date.now();

  if (delayMs <= 0) {
    emitExamStarted(key, startTimestamp);
    return;
  }

  if (scheduledExamTimers.has(key)) {
    return;
  }

  const timer = setTimeout(() => {
    emitExamStarted(key, startTimestamp);
    scheduledExamTimers.delete(key);
  }, delayMs);

  scheduledExamTimers.set(key, timer);
};

module.exports = {
  emitExamStarted,
  scheduleExamStartBroadcast,
  cancelExamStartBroadcast,
};
