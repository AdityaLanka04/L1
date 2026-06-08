const cleanString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const extractFromObject = (obj) => {
  if (!obj || typeof obj !== 'object') return '';

  const nestedKeys = [
    'text',
    'question',
    'question_text',
    'questionText',
    'prompt',
    'prompt_text',
    'promptText',
    'stem',
    'title',
    'label'
  ];

  for (const key of nestedKeys) {
    const text = cleanString(obj[key]);
    if (text) return text;
  }

  return '';
};

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options.map((option) => cleanString(option)).filter(Boolean);
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return parsed.map((option) => cleanString(option)).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const normalizeCorrectAnswer = (correctAnswer, optionsLength) => {
  if (typeof correctAnswer === 'number' && Number.isFinite(correctAnswer)) {
    return Math.min(Math.max(Math.trunc(correctAnswer), 0), Math.max(optionsLength - 1, 0));
  }

  if (typeof correctAnswer === 'string') {
    const trimmed = correctAnswer.trim();
    const numeric = Number(trimmed);
    if (Number.isInteger(numeric)) {
      return Math.min(Math.max(numeric, 0), Math.max(optionsLength - 1, 0));
    }

    const letterIndex = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (letterIndex >= 0) {
      return Math.min(letterIndex, Math.max(optionsLength - 1, 0));
    }
  }

  return 0;
};

export const extractQuestionText = (question) => {
  if (!question) return '';

  if (typeof question === 'string' || typeof question === 'number' || typeof question === 'boolean') {
    return cleanString(question);
  }

  if (typeof question !== 'object') return '';

  const directCandidates = [
    question.question,
    question.question_text,
    question.questionText,
    question.text,
    question.prompt,
    question.prompt_text,
    question.promptText,
    question.stem,
    question.title,
    question.label
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'object') {
      const nested = extractFromObject(candidate);
      if (nested) return nested;
      continue;
    }
    const text = cleanString(candidate);
    if (text) return text;
  }

  return '';
};

export const normalizeQuestion = (question) => {
  if (!question || typeof question !== 'object') {
    const text = extractQuestionText(question);
    return { question: text, question_text: text, options: [], correct_answer: 0 };
  }

  const text = extractQuestionText(question);
  const questionValue = typeof question.question === 'string' ? question.question : '';
  const questionTextValue = typeof question.question_text === 'string' ? question.question_text : '';
  const options = normalizeOptions(question.options);

  return {
    ...question,
    question: text || questionValue,
    question_text: text || questionTextValue,
    options,
    correct_answer: normalizeCorrectAnswer(question.correct_answer, options.length)
  };
};

export const normalizeQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return [];
  return questions.map(normalizeQuestion);
};
