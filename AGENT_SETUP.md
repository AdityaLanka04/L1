# Brainwave Agent System Setup Guide

## Phase 1: Foundation Setup

This guide covers setting up the LangGraph-based multi-agent system with Neo4j knowledge graph.

---

## 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Key new dependencies:
- `langgraph>=0.2.0` - Agent state machine framework
- `langchain>=0.3.0` - LLM orchestration
- `neo4j>=5.0.0` - Knowledge graph database
- `langsmith>=0.1.0` - Observability (optional)

---

## 2. Start Neo4j (Knowledge Graph)

### Option A: Docker (Recommended)
```bash
docker-compose -f docker-compose.neo4j.yml up -d
```

### Option B: Neo4j Desktop
1. Download from https://neo4j.com/download/
2. Create a new database
3. Set password to match `.env`

### Option C: Neo4j Aura (Cloud - Free Tier)
1. Sign up at https://neo4j.com/cloud/aura/
2. Create a free instance
3. Update `.env` with connection details:
```env
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
```

---

## 3. Configure Environment

Add to `backend/.env`:
```env
# Knowledge Graph
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

# Optional: LangSmith Tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-key
LANGCHAIN_PROJECT=brainwave-agents
```

---

## 4. Integrate with FastAPI

Add to `backend/main.py`:

```python
# At the top with other imports
from agents.setup import setup_agent_system, register_agent_routes

# After app initialization
register_agent_routes(app)

# In startup event
@app.on_event("startup")
async def startup_event():
    # ... existing startup code ...
    
    # Initialize agent system
    try:
        await setup_agent_system(app, unified_ai, enable_knowledge_graph=True)
        logger.info("✅ Agent system initialized")
    except Exception as e:
        logger.warning(f"⚠️ Agent system init failed: {e}")
```

---

## 5. Test the Setup

### Health Check
```bash
curl http://localhost:8000/api/agents/status
```

Expected response:
```json
{
  "status": "healthy",
  "registered_agents": ["orchestrator"],
  "knowledge_graph_connected": true
}
```

### Test Intent Classification
```bash
curl -X POST http://localhost:8000/api/agents/classify \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Create flashcards about photosynthesis"}'
```

### Test Full Agent Invocation
```bash
curl -X POST http://localhost:8000/api/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "user_input": "Explain the concept of derivatives in calculus"
  }'
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
├─────────────────────────────────────────────────────────────┤
│  /api/agents/invoke    →  OrchestratorAgent                 │
│  /api/agents/classify  →  IntentClassifier                  │
│  /api/agents/status    →  System Health                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   OrchestratorAgent                          │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌────────────────┐  │
│  │Validate │→ │ Classify │→ │ Enrich │→ │ Select Agents  │  │
│  └─────────┘  └──────────┘  └────────┘  └────────────────┘  │
│                                                │             │
│                                                ▼             │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────┐    │
│  │ Execute Agents │→ │   Aggregate   │→ │   Response   │    │
│  └────────────────┘  └───────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │Flashcard │   │   Chat   │   │   Quiz   │
        │  Agent   │   │  Agent   │   │  Agent   │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    ┌─────────────────┐
                    │ Knowledge Graph │
                    │     (Neo4j)     │
                    └─────────────────┘
```

---

## File Structure

```
backend/
├── agents/
│   ├── __init__.py           # Module exports
│   ├── base_agent.py         # BaseAgent class, AgentState
│   ├── orchestrator.py       # OrchestratorAgent, IntentClassifier
│   ├── agent_api.py          # FastAPI routes
│   ├── setup.py              # Integration helpers
│   └── config.py             # Configuration (existing)
├── knowledge_graph/
│   ├── __init__.py           # Module exports
│   ├── neo4j_client.py       # Neo4j connection & operations
│   ├── schema.py             # Node/relationship definitions
│   └── queries.py            # Common Cypher queries
```

---

## Next Steps (Phase 2)

After Phase 1 is working, implement specialized agents:

1. **FlashcardAgent** - Card generation, spaced repetition
2. **ChatAgent** - Conversational tutoring
3. **NotesAgent** - Summarization, concept extraction
4. **QuizAgent** - Question generation, adaptive testing
5. **SearchAgent** - Semantic search, RAG
6. **ConversionAgent** - PDF/media processing

Each agent follows the same pattern:
```python
class FlashcardAgent(BaseAgent):
    def __init__(self, ai_client, knowledge_graph):
        super().__init__(AgentType.FLASHCARD, ai_client, knowledge_graph)
    
    def _build_graph(self):
        # Define LangGraph state machine
        pass
    
    async def _process_input(self, state):
        # Validate and prepare input
        pass
    
    async def _execute_core_logic(self, state):
        # Main flashcard generation logic
        pass
    
    async def _format_response(self, state):
        # Format output
        pass
```

---

## Troubleshooting

### Neo4j Connection Failed
```
Error: Failed to connect to Neo4j
```
- Check if Neo4j is running: `docker ps`
- Verify credentials in `.env`
- Test connection: `curl http://localhost:7474`

### LangGraph Import Error
```
ModuleNotFoundError: No module named 'langgraph'
```
- Install: `pip install langgraph>=0.2.0`

### Agent Not Registered
```
Agent flashcard not available
```
- Agent not implemented yet (Phase 2)
- Orchestrator will fallback to chat agent
