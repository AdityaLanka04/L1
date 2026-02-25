

import { useState, useCallback } from 'react';
import quizAgentService from '../services/quizAgentService';

export function useQuizAgent(userId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  
  const generateQuiz = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.generateQuiz({
        userId,
        ...params
      });
      setQuestions(response.questions || []);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  
  const generateAdaptiveQuiz = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.generateAdaptiveQuiz({
        userId,
        ...params
      });
      setQuestions(response.questions || []);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  
  const gradeQuiz = useCallback(async (answers, timeTakenSeconds = null) => {
    if (!questions.length) {
      throw new Error('No questions to grade');
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.gradeQuiz({
        userId,
        questions,
        answers,
        timeTakenSeconds
      });
      setResults(response);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, questions]);

  
  const analyzePerformance = useCallback(async (gradingResults = null, timeTakenSeconds = null) => {
    const resultsToAnalyze = gradingResults || results?.results;
    if (!resultsToAnalyze) {
      throw new Error('No results to analyze');
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.analyzePerformance({
        userId,
        results: resultsToAnalyze,
        timeTakenSeconds
      });
      setAnalysis(response.analysis);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, results]);

  
  const getRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.getRecommendations(userId);
      setRecommendations(response.recommendations || []);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  
  const explainQuestion = useCallback(async (question, userAnswer = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.explainQuestion({
        userId,
        question,
        userAnswer
      });
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  
  const generateSimilar = useCallback(async (question, count = 1, difficulty = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.generateSimilarQuestions({
        userId,
        question,
        count,
        difficulty
      });
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  
  const reviewWrongAnswers = useCallback(async (gradingResults = null) => {
    const resultsToReview = gradingResults || results?.results;
    if (!resultsToReview) {
      throw new Error('No results to review');
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await quizAgentService.reviewWrongAnswers({
        userId,
        results: resultsToReview
      });
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, results]);

  
  const resetQuiz = useCallback(() => {
    setQuestions([]);
    setResults(null);
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    
    loading,
    error,
    questions,
    results,
    analysis,
    recommendations,
    
    
    generateQuiz,
    generateAdaptiveQuiz,
    gradeQuiz,
    analyzePerformance,
    getRecommendations,
    explainQuestion,
    generateSimilar,
    reviewWrongAnswers,
    resetQuiz,
    
    
    setQuestions,
    setResults,
    setError
  };
}

export default useQuizAgent;
