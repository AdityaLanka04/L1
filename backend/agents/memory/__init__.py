# Unified Memory Layer
# Provides shared context across all agents

from .unified_memory import UnifiedMemory, MemoryType, MemoryEntry
from .memory_manager import MemoryManager, get_memory_manager, initialize_memory_manager
from .enhanced_memory import (
    EnhancedMemorySystem,
    EnhancedMemoryEntry,
    MemoryPriority,
    EpisodicMemory,
    SemanticMemory,
    ProceduralMemory,
    MemoryConsolidator
)

__all__ = [
    # Core memory
    'UnifiedMemory',
    'MemoryType',
    'MemoryEntry',
    'MemoryManager',
    'get_memory_manager',
    'initialize_memory_manager',
    # Enhanced memory
    'EnhancedMemorySystem',
    'EnhancedMemoryEntry',
    'MemoryPriority',
    'EpisodicMemory',
    'SemanticMemory',
    'ProceduralMemory',
    'MemoryConsolidator'
]

