export const detectMathContent = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /\$[\s\S]+?\$|\\frac|\\sqrt|\\sum|\\int|\\alpha|\\beta|\\gamma|\\theta|\\pi|\^{|\_{/.test(text);
};

export const processMathInContent = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text;
};

export const normalizeMathDelimiters = (text) => {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, '$$$$$1$$$$');
  result = result.replace(/\\\((.+?)\\\)/g, '$$$1$$');
  return result;
};

export default {
  detectMathContent,
  processMathInContent,
  normalizeMathDelimiters
};