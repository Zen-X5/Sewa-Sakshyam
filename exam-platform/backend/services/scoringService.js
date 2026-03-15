const evaluateAttempt = ({ questions, answers, markingScheme }) => {
  const answerMap = new Map(answers.map((answer) => [String(answer.questionId), answer.selectedOption]));

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;

  for (const question of questions) {
    const selectedOption = answerMap.get(String(question._id));

    if (selectedOption === undefined) {
      unattemptedCount += 1;
      score += markingScheme.unattempted ?? 0;
      continue;
    }

    if (selectedOption === question.correctAnswer) {
      correctCount += 1;
      score += markingScheme.correct;
    } else {
      wrongCount += 1;
      score += markingScheme.wrong;
    }
  }

  return {
    score,
    correctCount,
    wrongCount,
    unattemptedCount,
  };
};

module.exports = {
  evaluateAttempt,
};
