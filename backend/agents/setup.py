"""
Agent System Setup and Integration
Initializes the LangGraph agent system with the main FastAPI app
"""

import logging
from typing import Optional
from fastapi import FastAPI

logger = logging.getLogger(__name__)


async def setup_agent_system(
    app: FastAPI, 
    ai_client, 
    enable_knowledge_graph: bool = True,
    db_session_factory = None
):
    """
    Initialize and integrate the intelligent agent system with FastAPI
    
    Args:
        app: FastAPI application instance
        ai_client: Unified AI client (Gemini/Groq)
        enable_knowledge_graph: Whether to connect to Neo4j
        db_session_factory: SQLAlchemy session factory for database access
    """
    from agents.agent_api import initialize_agent_system
    
    knowledge_graph = None
    user_knowledge_graph = None
    vector_store = None
    
    # Initialize knowledge graph if enabled
    if enable_knowledge_graph:
        try:
            from knowledge_graph import get_knowledge_graph, create_user_knowledge_graph
            knowledge_graph = await get_knowledge_graph()
            if knowledge_graph:
                # Create enhanced user knowledge graph service
                user_knowledge_graph = create_user_knowledge_graph(
                    knowledge_graph, 
                    db_session_factory
                )
                logger.info("✅ Knowledge Graph connected")
                logger.info("✅ User Knowledge Graph service initialized")
            else:
                logger.warning("Knowledge graph not available - running without it")
        except Exception as e:
            logger.warning(f" Knowledge graph initialization failed: {e}")
    
    # Initialize ChromaDB vector store
    try:
        import chromadb
        from chromadb.config import Settings
        
        chroma_client = chromadb.Client(Settings(
            anonymized_telemetry=False,
            allow_reset=True
        ))
        vector_store = chroma_client.get_or_create_collection(
            name="brainwave_content",
            metadata={"hnsw:space": "cosine"}
        )
        logger.info("✅ ChromaDB vector store initialized")
    except Exception as e:
        logger.warning(f"ChromaDB initialization failed: {e}")
        vector_store = None
    
    # Initialize intelligent agent system
    await initialize_agent_system(
        ai_client, 
        knowledge_graph, 
        db_session_factory,
        user_knowledge_graph
    )
    
    # Initialize Advanced AI System
    try:
        from agents.advanced_ai_features import initialize_advanced_ai
        initialize_advanced_ai(ai_client, db_session_factory)
        logger.info("✅ Advanced AI System initialized (reasoning, emotions, learning styles)")
    except Exception as e:
        logger.warning(f"Advanced AI initialization failed: {e}")
    
    # Initialize Enhanced Memory System
    try:
        from agents.memory.memory_api import initialize_enhanced_memory
        await initialize_enhanced_memory(
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            vector_store=vector_store,
            db_session_factory=db_session_factory
        )
        logger.info("✅ Enhanced Memory System initialized (episodic, semantic, procedural)")
    except Exception as e:
        logger.warning(f"Enhanced Memory initialization failed: {e}")
    
    # Initialize Advanced RAG System
    try:
        from agents.rag.rag_api import initialize_rag_system
        
        # Try to load embedding model for semantic search
        embedding_model = None
        try:
            from sentence_transformers import SentenceTransformer
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Embedding model loaded for semantic search")
        except Exception as e:
            logger.warning(f"Embedding model not loaded: {e}")
        
        await initialize_rag_system(
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            vector_store=vector_store,
            embedding_model=embedding_model
        )
        logger.info("✅ Advanced RAG System initialized (hybrid search, re-ranking, GraphRAG, agentic)")
    except Exception as e:
        logger.warning(f"Advanced RAG initialization failed: {e}")
    
    return True


def register_agent_routes(app: FastAPI):
    """
    Register agent API routes without async initialization.
    Call setup_agent_system() on startup for full initialization.
    """
    from agents.agent_api import router
    app.include_router(router)
    
    # Register Advanced AI API routes
    try:
        from agents.advanced_ai_api import router as advanced_ai_router
        app.include_router(advanced_ai_router)
        logger.info("✅ Advanced AI API routes registered")
    except Exception as e:
        logger.warning(f"Could not register Advanced AI routes: {e}")
    
    # Register Enhanced Memory API routes
    try:
        from agents.memory.memory_api import router as memory_router
        app.include_router(memory_router)
        logger.info("✅ Enhanced Memory API routes registered")
    except Exception as e:
        logger.warning(f"Could not register Memory routes: {e}")
    
    # Register Advanced RAG API routes
    try:
        from agents.rag.rag_api import router as rag_router
        app.include_router(rag_router)
        logger.info("✅ Advanced RAG API routes registered")
    except Exception as e:
        logger.warning(f"Could not register RAG routes: {e}")

