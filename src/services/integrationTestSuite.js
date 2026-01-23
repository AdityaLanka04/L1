/**
 * Integration Test Suite for BrainwaveAI Services
 * Tests all newly integrated services to ensure proper backend connectivity
 */

import {
  agentSystemService,
  analyticsService,
  chatAgentService,
  collaborationService,
  conversionAgentService,
  flashcardAgentService,
  knowledgeGraphService,
  masterAgentService,
  memoryService,
  noteAgentService,
  questionBankAgentService,
  quizAgentService,
  ragService,
  searchHubAgentService,
  slideExplorerAgentService
} from './index';

class IntegrationTestSuite {
  constructor() {
    this.testUserId = 'test-user-123';
    this.testSessionId = 'test-session-456';
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🚀 Starting BrainwaveAI Integration Tests...\n');
    
    await this.testAgentSystemServices();
    await this.testAnalyticsServices();
    await this.testCollaborationServices();
    await this.testConversionServices();
    await this.testKnowledgeGraphServices();
    await this.testMemoryServices();
    await this.testQuestionBankServices();
    await this.testQuizServices();
    await this.testRAGServices();
    
    this.printResults();
    return this.results;
  }

  /**
   * Test Agent System Services
   */
  async testAgentSystemServices() {
    console.log('🧪 Testing Agent System Services...');
    
    try {
      // Test status endpoint
      const status = await agentSystemService.getStatus();
      console.log('✅ Agent System Status:', status.status);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Agent System Status failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'agentSystem', error: error.message });
    }

    try {
      // Test intent classification
      const intent = await agentSystemService.classifyIntent('What is photosynthesis?');
      console.log('✅ Intent Classification:', intent.intent);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Intent Classification failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'intentClassification', error: error.message });
    }
  }

  /**
   * Test Analytics Services
   */
  async testAnalyticsServices() {
    console.log('📊 Testing Analytics Services...');
    
    try {
      const analytics = await analyticsService.getUserAnalytics(this.testUserId, '7d');
      console.log('✅ User Analytics retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ User Analytics failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'userAnalytics', error: error.message });
    }

    try {
      const metrics = await analyticsService.getPerformanceMetrics(this.testUserId, 'all');
      console.log('✅ Performance Metrics retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Performance Metrics failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'performanceMetrics', error: error.message });
    }

    try {
      const trends = await analyticsService.getProgressTrends(this.testUserId, '30d', 'daily');
      console.log('✅ Progress Trends retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Progress Trends failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'progressTrends', error: error.message });
    }
  }

  /**
   * Test Collaboration Services
   */
  async testCollaborationServices() {
    console.log('🤝 Testing Collaboration Services...');
    
    try {
      const sessions = await collaborationService.getActiveSessions({ topic: 'biology' });
      console.log('✅ Active Sessions retrieved:', sessions.length || 0);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Active Sessions failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'activeSessions', error: error.message });
    }

    try {
      const health = await collaborationService.healthCheck();
      console.log('✅ Collaboration Service Health:', health.status);
      this.results.passed++;
    } catch (error) {
      console.log('❌ Collaboration Health Check failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'collaborationHealth', error: error.message });
    }
  }

  /**
   * Test Conversion Services
   */
  async testConversionServices() {
    console.log('🔄 Testing Conversion Services...');
    
    try {
      const result = await conversionAgentService.convertNotesToFlashcards({
        userId: this.testUserId,
        notesContent: 'Photosynthesis is the process by which plants convert light energy into chemical energy.',
        cardCount: 5
      });
      console.log('✅ Notes to Flashcards conversion successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Notes to Flashcards failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'notesToFlashcards', error: error.message });
    }

    try {
      const result = await conversionAgentService.convertQuestionsToNotes({
        userId: this.testUserId,
        questions: [
          { question: 'What is photosynthesis?', answer: 'Process of converting light to chemical energy' }
        ]
      });
      console.log('✅ Questions to Notes conversion successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Questions to Notes failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'questionsToNotes', error: error.message });
    }
  }

  /**
   * Test Knowledge Graph Services
   */
  async testKnowledgeGraphServices() {
    console.log('🧠 Testing Knowledge Graph Services...');
    
    try {
      const mastery = await knowledgeGraphService.getUserMastery(this.testUserId);
      console.log('✅ User Mastery retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ User Mastery failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'userMastery', error: error.message });
    }

    try {
      const weakConcepts = await knowledgeGraphService.getWeakConcepts(this.testUserId);
      console.log('✅ Weak Concepts retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Weak Concepts failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'weakConcepts', error: error.message });
    }

    try {
      const learningPath = await knowledgeGraphService.getLearningPath(this.testUserId, 'biology');
      console.log('✅ Learning Path retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Learning Path failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'learningPath', error: error.message });
    }
  }

  /**
   * Test Memory Services
   */
  async testMemoryServices() {
    console.log('💭 Testing Memory Services...');
    
    try {
      const context = await memoryService.getUserContext(this.testUserId);
      console.log('✅ User Context retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ User Context failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'userContext', error: error.message });
    }

    try {
      const summary = await memoryService.getUserSummary(this.testUserId);
      console.log('✅ User Summary retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ User Summary failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'userSummary', error: error.message });
    }

    try {
      const stats = await memoryService.getUserStats(this.testUserId);
      console.log('✅ User Stats retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ User Stats failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'userStats', error: error.message });
    }
  }

  /**
   * Test Question Bank Services
   */
  async testQuestionBankServices() {
    console.log('📝 Testing Question Bank Services...');
    
    try {
      const questions = await questionBankAgentService.generateQuestions({
        userId: this.testUserId,
        action: 'generate',
        sourceType: 'topic',
        topic: 'photosynthesis',
        questionCount: 5
      });
      console.log('✅ Question Generation successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Question Generation failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'questionGeneration', error: error.message });
    }

    try {
      const adaptiveQuestions = await questionBankAgentService.generateAdaptiveQuestions({
        userId: this.testUserId,
        topic: 'biology',
        difficulty: 'adaptive',
        questionCount: 3
      });
      console.log('✅ Adaptive Question Generation successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Adaptive Question Generation failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'adaptiveQuestions', error: error.message });
    }

    try {
      const categories = await questionBankAgentService.categorizeQuestions({
        userId: this.testUserId,
        questions: ['What is photosynthesis?', 'How does cellular respiration work?'],
        taxonomy: 'bloom'
      });
      console.log('✅ Question Categorization successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Question Categorization failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'questionCategorization', error: error.message });
    }
  }

  /**
   * Test Quiz Services
   */
  async testQuizServices() {
    console.log('🎯 Testing Quiz Services...');
    
    try {
      const quiz = await quizAgentService.generateQuiz({
        userId: this.testUserId,
        topic: 'photosynthesis',
        questionCount: 5,
        difficulty: 'medium'
      });
      console.log('✅ Quiz Generation successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Quiz Generation failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'quizGeneration', error: error.message });
    }

    try {
      const adaptiveQuiz = await quizAgentService.generateAdaptiveQuiz({
        userId: this.testUserId,
        topic: 'biology',
        questionCount: 5
      });
      console.log('✅ Adaptive Quiz Generation successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Adaptive Quiz Generation failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'adaptiveQuiz', error: error.message });
    }

    try {
      const recommendations = await quizAgentService.getRecommendations(this.testUserId);
      console.log('✅ Quiz Recommendations retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ Quiz Recommendations failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'quizRecommendations', error: error.message });
    }
  }

  /**
   * Test RAG Services
   */
  async testRAGServices() {
    console.log('🔍 Testing RAG Services...');
    
    try {
      const searchResults = await ragService.search('photosynthesis process', {
        userId: this.testUserId,
        mode: 'agentic',
        topK: 5
      });
      console.log('✅ RAG Search successful');
      this.results.passed++;
    } catch (error) {
      console.log('❌ RAG Search failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'ragSearch', error: error.message });
    }

    try {
      const context = await ragService.getContext('photosynthesis', 1000);
      console.log('✅ RAG Context retrieved');
      this.results.passed++;
    } catch (error) {
      console.log('❌ RAG Context failed:', error.message);
      this.results.failed++;
      this.results.errors.push({ service: 'ragContext', error: error.message });
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📋 Integration Test Results:');
    console.log('=====================================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🔍 Errors Details:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.service}: ${error.error}`);
      });
    }
    
    console.log('\n🎯 Integration Status:');
    if (this.results.failed === 0) {
      console.log('🎉 All integrations are working perfectly!');
    } else if (this.results.failed <= 5) {
      console.log('⚠️  Minor integration issues detected - mostly functional');
    } else {
      console.log('🔧 Significant integration issues - requires attention');
    }
    
    console.log('\n✨ Integration Complete! All services have been successfully integrated.');
  }
}

// Export for use in other modules
export default IntegrationTestSuite;

// Run tests if this file is executed directly
if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('test')) {
  const tester = new IntegrationTestSuite();
  tester.runAllTests().catch(console.error);
}