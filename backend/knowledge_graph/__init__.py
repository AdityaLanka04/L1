# Knowledge Graph Module
# Neo4j-based knowledge graph for learning context

from .neo4j_client import Neo4jClient, get_knowledge_graph
from .schema import NodeType, RelationType, ConceptNode, UserNode
from .queries import KnowledgeGraphQueries

__all__ = [
    'Neo4jClient',
    'get_knowledge_graph',
    'NodeType',
    'RelationType', 
    'ConceptNode',
    'UserNode',
    'KnowledgeGraphQueries'
]
