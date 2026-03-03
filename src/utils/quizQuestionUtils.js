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
    return { question: text, question_text: text };
  }

  const text = extractQuestionText(question);
  const questionValue = typeof question.question === 'string' ? question.question : '';
  const questionTextValue = typeof question.question_text === 'string' ? question.question_text : '';

  return {
    ...question,
    question: text || questionValue,
    question_text: text || questionTextValue
  };
};

export const normalizeQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return [];
  return questions.map(normalizeQuestion);
};
