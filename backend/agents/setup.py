"""
Agent System Setup and Integration
Initializes the LangGraph agent system with the main FastAPI app
"""

import logging
from typing import Optional
from fastapi import FastAPI

logger = logging.getLogger(__name__)


async def setup_agent_system(app: FastAPI, ai_client, enable_knowledge_graph: bool = True):
    """
    Initialize and integrate the agent system with FastAPI
    
    Args:
        app: FastAPI application instance
        ai_client: Unified AI client (Gemini/Groq)
        enable_knowledge_graph: Whether to connect to Neo4j
    """
    from agents.agent_api import initialize_agent_system
    
    knowledge_graph = None
    
    # Initialize knowledge graph if enabled
    if enable_knowledge_graph:
        try:
            from knowledge_graph import get_knowledge_graph
            knowledge_graph = await get_knowledge_graph()
            if knowledge_graph:
                logger.info("✅ Knowledge graph connected")
            else:
                logger.warning("⚠️ Knowledge graph not available - running without it")
        except Exception as e:
            logger.warning(f"⚠️ Knowledge graph initialization failed: {e}")
    
    # Initialize agent system
    await initialize_agent_system(ai_client, knowledge_graph)
    
    logger.info("✅ Agent system setup complete")
    
    return True


def register_agent_routes(app: FastAPI):
    """
    Register agent API routes without async initialization.
    Call setup_agent_system() on startup for full initialization.
    """
    from agents.agent_api import router
    app.include_router(router)
    logger.info("Agent API routes registered")
