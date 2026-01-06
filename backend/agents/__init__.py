# Brainwave AI Agent System
# LangGraph-based multi-agent architecture with Knowledge Graph integration

from .base_agent import BaseAgent, AgentState, AgentResponse, AgentType, agent_registry
from .orchestrator import OrchestratorAgent, IntentClassifier
from .chat_agent import ChatAgent, create_chat_agent, ChatMode, ResponseStyle
from .flashcard_agent import FlashcardAgent, create_flashcard_agent, FlashcardAction
from .note_agent import NoteAgent, create_note_agent, NoteAction, WritingTone, ContentDepth
from .quiz_agent import QuizAgent, create_quiz_agent, QuizAction, QuestionType, DifficultyLevel
from .question_bank_agent import QuestionBankAgent, create_question_bank_agent
from .slide_explorer_agent import SlideExplorerAgent, create_slide_explorer_agent
from .intelligent_orchestrator import IntelligentOrchestrator, create_intelligent_orchestrator
from .react_agent import ReActAgent, create_react_agent
from .conversion_agent import ConversionAgent, create_conversion_agent, ConversionAction
from .search_hub_agent import SearchHubAgent, create_search_hub_agent, SearchHubAction
from .master_agent import MasterAgent, create_master_agent, MasterAction
from .memory import MemoryManager, get_memory_manager, initialize_memory_manager

__all__ = [
    # Base
    'BaseAgent',
    'AgentState', 
    'AgentResponse',
    'AgentType',
    'agent_registry',
    # Orchestrators
    'OrchestratorAgent',
    'IntentClassifier',
    'IntelligentOrchestrator',
    'create_intelligent_orchestrator',
    # Chat Agent
    'ChatAgent',
    'create_chat_agent',
    'ChatMode',
    'ResponseStyle',
    # Flashcard Agent
    'FlashcardAgent',
    'create_flashcard_agent',
    'FlashcardAction',
    # Note Agent
    'NoteAgent',
    'create_note_agent',
    'NoteAction',
    'WritingTone',
    'ContentDepth',
    # Quiz Agent
    'QuizAgent',
    'create_quiz_agent',
    'QuizAction',
    'QuestionType',
    'DifficultyLevel',
    # Question Bank Agent
    'QuestionBankAgent',
    'create_question_bank_agent',
    # Slide Explorer Agent
    'SlideExplorerAgent',
    'create_slide_explorer_agent',
    # Conversion Agent
    'ConversionAgent',
    'create_conversion_agent',
    'ConversionAction',
    # SearchHub Agent
    'SearchHubAgent',
    'create_search_hub_agent',
    'SearchHubAction',
    # Master Agent
    'MasterAgent',
    'create_master_agent',
    'MasterAction',
    # ReAct
    'ReActAgent',
    'create_react_agent',
    # Memory
    'MemoryManager',
    'get_memory_manager',
    'initialize_memory_manager',
]

