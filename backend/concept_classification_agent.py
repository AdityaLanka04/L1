"""
Intelligent Concept Classification Agent
Properly classifies notes, flashcards, quizzes, and chats into meaningful topics
"""

import json
import logging
from typing import List, Dict, Any, Tuple
from groq import Groq
import os

logger = logging.getLogger(__name__)

class ConceptClassificationAgent:
    """AI agent that intelligently classifies learning content into topics"""
    
    def __init__(self, groq_client=None, model_name: str = "llama-3.3-70b-versatile", 
                 gemini_client=None, gemini_model: str = "gemini-2.0-flash", gemini_api_key: str = None):
        self.groq_client = groq_client
        self.model_name = model_name
        self.gemini_module = gemini_client  # This is the genai module
        self.gemini_model = gemini_model
        self.gemini_api_key = gemini_api_key
        
        # Use REST API for Gemini (SDK hangs)
        if gemini_api_key:
            self.primary_ai = "gemini"
            logger.info(f"ConceptAgent using GEMINI REST API as primary (model: {gemini_model})")
        elif groq_client:
            self.primary_ai = "groq"
            logger.info("ConceptAgent using GROQ as primary")
        else:
            raise ValueError("At least one AI client (Gemini API key or Groq) must be provided")
        
        # ULTRA-ADVANCED hierarchical categories with deep subcategories
        self.category_hierarchy = {
            "Computer Science": {
                "subcategories": ["Algorithms", "Data Structures", "Machine Learning", "Web Development", 
                                "Databases", "Operating Systems", "Networks", "Security", "AI/ML", "Software Engineering"],
                "advanced_topics": {
                    "Algorithms": ["Sorting Algorithms", "Searching Algorithms", "Graph Algorithms", "Dynamic Programming", 
                                  "Greedy Algorithms", "Divide and Conquer", "Backtracking", "Branch and Bound",
                                  "String Algorithms", "Computational Geometry"],
                    "Sorting Algorithms": ["Merge Sort", "Quick Sort", "Heap Sort", "Radix Sort", "Counting Sort", 
                                          "Bucket Sort", "Tim Sort", "Shell Sort", "Insertion Sort", "Selection Sort",
                                          "Bubble Sort", "Cocktail Sort", "Comb Sort"],
                    "Searching Algorithms": ["Binary Search", "Linear Search", "Jump Search", "Interpolation Search",
                                            "Exponential Search", "Fibonacci Search", "Ternary Search"],
                    "Data Structures": ["Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Graphs", "Hash Tables", 
                                       "Heaps", "Tries", "Segment Trees", "Fenwick Trees", "Disjoint Set Union",
                                       "Skip Lists", "B-Trees", "Red-Black Trees", "AVL Trees", "Splay Trees"],
                    "Graph Algorithms": ["BFS", "DFS", "Dijkstra's Algorithm", "Bellman-Ford", "Floyd-Warshall", 
                                        "Kruskal's Algorithm", "Prim's Algorithm", "Topological Sort", "Tarjan's Algorithm",
                                        "Kosaraju's Algorithm", "A* Search", "Bidirectional Search", "Johnson's Algorithm"],
                    "Dynamic Programming": ["Knapsack Problem", "Longest Common Subsequence", "Edit Distance",
                                           "Matrix Chain Multiplication", "Coin Change", "Rod Cutting", "Fibonacci DP"],
                    "Machine Learning": ["Neural Networks", "Deep Learning", "Supervised Learning", "Unsupervised Learning", 
                                        "Reinforcement Learning", "NLP", "Computer Vision", "CNNs", "RNNs", "Transformers",
                                        "GANs", "Autoencoders", "Transfer Learning", "Ensemble Methods"],
                    "Web Development": ["React", "Angular", "Vue.js", "Node.js", "Express", "Django", "Flask",
                                       "REST APIs", "GraphQL", "WebSockets", "OAuth", "JWT", "Microservices"],
                    "Databases": ["SQL", "NoSQL", "MongoDB", "PostgreSQL", "MySQL", "Redis", "Cassandra",
                                 "Database Indexing", "Query Optimization", "Transactions", "ACID Properties"]
                }
            },
            "Mathematics": {
                "subcategories": ["Calculus", "Linear Algebra", "Discrete Math", "Statistics", "Probability",
                                "Number Theory", "Geometry", "Topology", "Abstract Algebra", "Real Analysis"],
                "advanced_topics": {
                    "Calculus": ["Derivatives", "Integrals", "Limits", "Series", "Multivariable Calculus",
                                "Partial Derivatives", "Multiple Integrals", "Vector Calculus", "Differential Equations"],
                    "Linear Algebra": ["Matrices", "Eigenvalues", "Eigenvectors", "Vector Spaces", "Linear Transformations",
                                      "Determinants", "Matrix Decomposition", "SVD", "PCA", "Orthogonality"],
                    "Discrete Math": ["Graph Theory", "Combinatorics", "Logic", "Set Theory", "Relations", "Functions",
                                     "Recurrence Relations", "Generating Functions", "Pigeonhole Principle"],
                    "Statistics": ["Descriptive Statistics", "Inferential Statistics", "Hypothesis Testing", "Regression",
                                  "ANOVA", "Chi-Square Test", "Confidence Intervals", "P-Values", "Bayesian Statistics"],
                    "Probability": ["Random Variables", "Probability Distributions", "Expected Value", "Variance",
                                   "Conditional Probability", "Bayes Theorem", "Markov Chains", "Central Limit Theorem"]
                }
            },
            "Physics": {
                "subcategories": ["Classical Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Mechanics", 
                                "Relativity", "Optics", "Waves", "Particle Physics", "Astrophysics", "Nuclear Physics"],
                "advanced_topics": {
                    "Classical Mechanics": ["Newton's Laws", "Kinematics", "Dynamics", "Energy", "Momentum",
                                           "Rotational Motion", "Oscillations", "Gravitation"],
                    "Quantum Mechanics": ["Wave-Particle Duality", "Schrödinger Equation", "Quantum States",
                                         "Uncertainty Principle", "Quantum Entanglement", "Quantum Tunneling"],
                    "Electromagnetism": ["Electric Fields", "Magnetic Fields", "Maxwell's Equations", "Electromagnetic Waves",
                                        "Faraday's Law", "Ampere's Law", "Gauss's Law"]
                }
            },
            "Chemistry": {
                "subcategories": ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", 
                                "Analytical Chemistry", "Biochemistry", "Quantum Chemistry"],
                "advanced_topics": {
                    "Organic Chemistry": ["Alkanes", "Alkenes", "Alkynes", "Aromatic Compounds", "Functional Groups",
                                         "Reaction Mechanisms", "Stereochemistry", "Spectroscopy"],
                    "Biochemistry": ["Proteins", "Enzymes", "DNA", "RNA", "Metabolism", "Glycolysis",
                                    "Krebs Cycle", "Electron Transport Chain", "Photosynthesis"]
                }
            },
            "Biology": {
                "subcategories": ["Molecular Biology", "Genetics", "Ecology", "Evolution", "Cell Biology",
                                "Anatomy", "Physiology", "Microbiology", "Immunology", "Neuroscience"],
                "advanced_topics": {
                    "Molecular Biology": ["DNA Replication", "Transcription", "Translation", "Gene Expression",
                                         "PCR", "CRISPR", "Cloning", "Sequencing"],
                    "Genetics": ["Mendelian Genetics", "Population Genetics", "Genetic Mutations", "Inheritance Patterns",
                                "Genetic Engineering", "Epigenetics", "Genomics"],
                    "Cell Biology": ["Cell Structure", "Cell Membrane", "Organelles", "Mitosis", "Meiosis",
                                    "Cell Signaling", "Apoptosis", "Cell Cycle"],
                    "Neuroscience": ["Neurons", "Synapses", "Neurotransmitters", "Action Potentials", "Brain Structure",
                                    "Neural Networks", "Memory", "Learning"]
                }
            },
            "Engineering": {
                "subcategories": ["Software Engineering", "Electrical Engineering", "Mechanical Engineering",
                                "Civil Engineering", "Chemical Engineering", "Systems Engineering", "Aerospace Engineering"],
                "advanced_topics": {
                    "Software Engineering": ["Design Patterns", "SOLID Principles", "Agile", "Scrum", "DevOps",
                                            "CI/CD", "Testing", "Code Review", "Version Control", "Git"],
                    "Electrical Engineering": ["Circuit Analysis", "Digital Logic", "Microprocessors", "Signal Processing",
                                              "Control Systems", "Power Systems", "Electronics"]
                }
            },
            "General": {
                "subcategories": ["Academic Field", "Personal Development", "Communication", "Social Skills",
                                "Business", "Economics", "Psychology", "Philosophy"],
                "advanced_topics": {}
            }
        }
        
        self.predefined_categories = list(self.category_hierarchy.keys())
    
    def extract_concepts_from_text(self, text: str, content_type: str = "general") -> List[Dict[str, Any]]:
        """
        Extract key concepts from text using advanced hierarchical classification
        
        Args:
            text: The text to analyze
            content_type: Type of content (note, flashcard, quiz, chat)
        
        Returns:
            List of concepts with name, category, subcategory, and description
        """
        if not text or len(text.strip()) < 10:
            return []
        
        # Build advanced category context
        category_context = self._build_category_context()
        
        prompt = f"""You are an expert knowledge classifier. Analyze this {content_type} and extract SPECIFIC, GRANULAR concepts.

Content:
{text[:2000]}

IMPORTANT CLASSIFICATION RULES:
1. Be VERY SPECIFIC - Don't say "Algorithms", say "Merge Sort" or "Quick Sort"
2. Use TECHNICAL TERMS - "Binary Search Tree" not "Tree", "Dijkstra's Algorithm" not "Graph Algorithm"
3. Identify EXACT topics - "Supervised Learning" not "Machine Learning", "Calculus Derivatives" not "Calculus"

{category_context}

For each concept, provide:
- concept_name: SPECIFIC technical name (e.g., "Merge Sort", "Neural Networks", "Eigenvalues")
- category: Main category from the list above
- subcategory: Specific subcategory (e.g., "Sorting Algorithms", "Machine Learning", "Linear Algebra")
- description: Technical 1-sentence description
- difficulty_level: "beginner", "intermediate", or "advanced"
- prerequisites: List of 0-3 prerequisite concept names (if any)

Return ONLY a JSON array. Example:
[
  {{
    "concept_name": "Merge Sort",
    "category": "Computer Science",
    "subcategory": "Sorting Algorithms",
    "description": "Divide-and-conquer sorting algorithm with O(n log n) time complexity",
    "difficulty_level": "intermediate",
    "prerequisites": ["Recursion", "Arrays"]
  }},
  {{
    "concept_name": "Quick Sort",
    "category": "Computer Science", 
    "subcategory": "Sorting Algorithms",
    "description": "In-place sorting algorithm using partitioning with average O(n log n) complexity",
    "difficulty_level": "intermediate",
    "prerequisites": ["Recursion", "Divide and Conquer"]
  }}
]

Extract 1-8 SPECIFIC concepts. Return ONLY the JSON array."""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            concepts = json.loads(result_text)
            
            # Validate and clean concepts with advanced classification
            validated_concepts = []
            for concept in concepts:
                if isinstance(concept, dict) and "concept_name" in concept:
                    # Ensure category is valid
                    if concept.get("category") not in self.predefined_categories:
                        concept["category"] = self._infer_category(concept["concept_name"])
                    
                    # Ensure subcategory exists
                    if not concept.get("subcategory"):
                        concept["subcategory"] = self._infer_subcategory(
                            concept["concept_name"], 
                            concept.get("category", "General")
                        )
                    
                    # Ensure description exists
                    if not concept.get("description"):
                        concept["description"] = f"A concept related to {concept['concept_name']}"
                    
                    # Ensure difficulty level
                    if not concept.get("difficulty_level"):
                        concept["difficulty_level"] = "intermediate"
                    
                    # Ensure prerequisites is a list
                    if not concept.get("prerequisites"):
                        concept["prerequisites"] = []
                    elif isinstance(concept["prerequisites"], str):
                        concept["prerequisites"] = [concept["prerequisites"]]
                    
                    validated_concepts.append(concept)
            
            return validated_concepts[:8]  # Max 8 concepts
            
        except Exception as e:
            logger.error(f"Error extracting concepts: {e}")
            return []
    
    def classify_content_into_concept(self, content: str, existing_concepts: List[str]) -> Tuple[str, float]:
        """
        Classify content into one of the existing concepts
        
        Args:
            content: The content to classify
            existing_concepts: List of existing concept names
        
        Returns:
            Tuple of (concept_name, confidence_score)
        """
        if not existing_concepts:
            return None, 0.0
        
        if len(content) < 10:
            return None, 0.0
        
        prompt = f"""Given this content, which concept does it relate to most?

Content:
{content[:1000]}

Available concepts:
{', '.join(existing_concepts)}

Respond with ONLY the concept name that best matches, or "NONE" if no good match.
Choose the MOST SPECIFIC and RELEVANT concept."""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=50
            )
            
            result = response.choices[0].message.content.strip()
            
            # Check if result matches any existing concept
            for concept in existing_concepts:
                if concept.lower() in result.lower():
                    return concept, 0.8
            
            if "NONE" in result.upper():
                return None, 0.0
            
            return None, 0.0
            
        except Exception as e:
            logger.error(f"Error classifying content: {e}")
            return None, 0.0
    
    def find_concept_connections(self, concept1: str, concept2: str, description1: str = "", description2: str = "") -> Dict[str, Any]:
        """
        Determine if two concepts are related and how
        
        Args:
            concept1: First concept name
            concept2: Second concept name
            description1: Description of first concept
            description2: Description of second concept
        
        Returns:
            Dict with connection_type, strength, and description
        """
        prompt = f"""Analyze the relationship between these two concepts:

Concept 1: {concept1}
{f"Description: {description1}" if description1 else ""}

Concept 2: {concept2}
{f"Description: {description2}" if description2 else ""}

Determine:
1. Are they related? (yes/no)
2. Connection type: prerequisite, related, opposite, example_of, part_of
3. Strength: 0.0 to 1.0 (how strongly related)

Respond with ONLY a JSON object:
{{"related": true/false, "connection_type": "type", "strength": 0.8}}

If not related, return: {{"related": false}}"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=100
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            result = json.loads(result_text)
            
            if result.get("related", False):
                return {
                    "connection_type": result.get("connection_type", "related"),
                    "strength": min(max(result.get("strength", 0.5), 0.0), 1.0),
                    "description": f"{concept1} and {concept2} are connected"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding connections: {e}")
            return None
    
    def _build_category_context(self) -> str:
        """Build detailed category context for better classification"""
        context_parts = ["Available categories with subcategories:"]
        
        for category, data in self.category_hierarchy.items():
            subcats = ", ".join(data["subcategories"][:5])
            context_parts.append(f"- {category}: {subcats}")
            
            # Add advanced topics for key categories
            if category in ["Computer Science", "Mathematics"]:
                for subcat, topics in list(data["advanced_topics"].items())[:3]:
                    topics_str = ", ".join(topics[:5])
                    context_parts.append(f"  • {subcat}: {topics_str}")
        
        return "\n".join(context_parts)
    
    def _infer_category(self, concept_name: str) -> str:
        """Infer category from concept name using keyword matching"""
        name_lower = concept_name.lower()
        
        # Computer Science keywords
        cs_keywords = ["algorithm", "sort", "search", "tree", "graph", "hash", "array", 
                      "linked", "stack", "queue", "heap", "neural", "machine learning",
                      "programming", "code", "software", "database", "network"]
        
        # Math keywords
        math_keywords = ["calculus", "derivative", "integral", "matrix", "vector", "algebra",
                        "equation", "theorem", "proof", "geometry", "trigonometry"]
        
        # Physics keywords
        physics_keywords = ["force", "energy", "momentum", "quantum", "relativity", "wave",
                           "particle", "thermodynamics", "mechanics"]
        
        if any(kw in name_lower for kw in cs_keywords):
            return "Computer Science"
        elif any(kw in name_lower for kw in math_keywords):
            return "Mathematics"
        elif any(kw in name_lower for kw in physics_keywords):
            return "Physics"
        
        return "General"
    
    def _infer_subcategory(self, concept_name: str, category: str) -> str:
        """Infer subcategory from concept name"""
        name_lower = concept_name.lower()
        
        if category == "Computer Science":
            if any(word in name_lower for word in ["sort", "merge", "quick", "heap", "bubble"]):
                return "Sorting Algorithms"
            elif any(word in name_lower for word in ["search", "bfs", "dfs", "dijkstra", "graph"]):
                return "Graph Algorithms"
            elif any(word in name_lower for word in ["tree", "binary", "avl", "red-black"]):
                return "Data Structures"
            elif any(word in name_lower for word in ["neural", "learning", "ai", "ml"]):
                return "Machine Learning"
            return "Algorithms"
        
        elif category == "Mathematics":
            if any(word in name_lower for word in ["derivative", "integral", "limit"]):
                return "Calculus"
            elif any(word in name_lower for word in ["matrix", "vector", "eigen"]):
                return "Linear Algebra"
            elif any(word in name_lower for word in ["graph", "combinatorics", "discrete"]):
                return "Discrete Math"
            return "General Mathematics"
        
        return category
    
    def merge_similar_concepts(self, concepts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merge concepts that are very similar using advanced similarity detection
        
        Args:
            concepts: List of concept dictionaries
        
        Returns:
            Deduplicated list of concepts
        """
        if len(concepts) <= 1:
            return concepts
        
        # Advanced deduplication with subcategory awareness
        unique_concepts = []
        seen_names = set()
        
        for concept in concepts:
            name_lower = concept["concept_name"].lower().strip()
            
            # Check if we've seen a very similar name
            is_duplicate = False
            for seen_name in seen_names:
                # Exact match or substring match
                if name_lower == seen_name or name_lower in seen_name or seen_name in name_lower:
                    is_duplicate = True
                    break
                
                # Check for common abbreviations
                if self._are_concepts_similar(name_lower, seen_name):
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_concepts.append(concept)
                seen_names.add(name_lower)
        
        return unique_concepts
    
    def _are_concepts_similar(self, name1: str, name2: str) -> bool:
        """Check if two concept names are similar"""
        # Remove common words
        common_words = {"the", "a", "an", "of", "in", "to", "for", "and", "or"}
        
        words1 = set(name1.split()) - common_words
        words2 = set(name2.split()) - common_words
        
        # If they share most words, they're similar
        if len(words1) > 0 and len(words2) > 0:
            overlap = len(words1 & words2)
            min_len = min(len(words1), len(words2))
            if overlap / min_len > 0.7:
                return True
        
        return False
    
    def _call_ai(self, prompt: str, max_tokens: int = 2000) -> str:
        """
        Call AI with Gemini as primary, Groq as fallback
        
        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response
        
        Returns:
            AI response text
        """
        try:
            if self.primary_ai == "gemini" and self.gemini_api_key:
                logger.info("Calling Gemini REST API...")
                import requests
                
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}"
                
                payload = {
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": max_tokens,
                    }
                }
                
                # Use longer timeout for batch classification (30s)
                timeout = 30 if max_tokens > 2000 else 15
                response = requests.post(url, json=payload, timeout=timeout)
                
                if response.status_code == 200:
                    data = response.json()
                    text = data['candidates'][0]['content']['parts'][0]['text']
                    logger.info(f"✅ Gemini REST response received")
                    return text
                else:
                    logger.error(f"❌ Gemini REST API error: {response.status_code}")
                    raise Exception(f"Gemini API error: {response.status_code}")
                    
            elif self.groq_client:
                logger.info("Calling Groq API...")
                response = self.groq_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content.strip()
            else:
                raise Exception("No AI client available")
        except Exception as e:
            logger.error(f"Primary AI ({self.primary_ai}) failed: {e}")
            # Fallback to other AI
            if self.primary_ai == "gemini" and self.groq_client:
                logger.info("Falling back to Groq...")
                response = self.groq_client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content.strip()
            else:
                raise Exception(f"Both AI clients failed: {e}")
    
    def ai_classify_batch_concepts(self, concepts: List[str]) -> List[Dict[str, Any]]:
        """
        Classify multiple concepts in a single AI request (much faster, avoids rate limits)
        
        Args:
            concepts: List of concept names to classify
        
        Returns:
            List of classification dicts for each concept
        """
        if not concepts:
            return []
        
        concepts_list = "\n".join([f"{i+1}. {name}" for i, name in enumerate(concepts)])
        
        prompt = f"""You are an expert knowledge classifier. Analyze these {len(concepts)} concepts and group them intelligently.

CONCEPTS TO CLASSIFY:
{concepts_list}

CRITICAL CLASSIFICATION RULES:

1. GROUP RELATED CONCEPTS TOGETHER:
   - "Merge Sort", "Quick Sort", "Hashing" → ALL should be "Algorithm Analysis" or "Data Structures & Algorithms"
   - "Newtons Laws", "Newtons Laws Flashcards" → BOTH should be "Newtons Laws" or "Classical Mechanics"
   - "Messi", "Football", "Sports" → ALL should be "Sports" or specific sport name

2. BE SPECIFIC BUT LOGICAL:
   - If multiple concepts are about sorting → category: "Sorting Algorithms"
   - If multiple concepts are about physics laws → category: "Classical Mechanics" or "Physics Laws"
   - If multiple concepts are about a person/topic → use that topic as category

3. SMART GROUPING EXAMPLES:
   ✓ GOOD: "Merge Sort", "Quick Sort" → category: "Sorting Algorithms"
   ✗ BAD: "Merge Sort" → "Computer Science", "Quick Sort" → "Algorithms" (inconsistent!)
   
   ✓ GOOD: "Newtons Laws", "Newtons Laws Flashcards" → category: "Newtons Laws"
   ✗ BAD: One as "Physics", other as "Classical Mechanics" (inconsistent!)
   
   ✓ GOOD: "Messi", "Football" → category: "Sports" or "Football"
   ✗ BAD: "Messi" → "General", "Football" → "Sports" (inconsistent!)

4. CATEGORY HIERARCHY:
   - Use the MOST SPECIFIC common category that groups related concepts
   - "Algorithm Analysis" > "Computer Science" (more specific)
   - "Newtons Laws" > "Physics" (more specific)
   - "Football" > "Sports" (more specific)

5. LOOK FOR PATTERNS:
   - Multiple sorting algorithms? → "Sorting Algorithms"
   - Multiple physics concepts? → "Classical Mechanics" or specific law
   - Multiple about same person/topic? → Use that as category
   - Flashcards/quizzes about X? → Category should be X

6. SUBCATEGORY RULES:
   - subcategory = broader context (e.g., "Data Structures & Algorithms")
   - category = specific grouping (e.g., "Sorting Algorithms")
   - advanced_topic = exact concept (e.g., "Merge Sort")

Return ONLY a JSON array with {len(concepts)} objects:
[
  {{
    "concept_name": "original name",
    "category": "Specific grouping category (e.g., 'Sorting Algorithms', 'Newtons Laws', 'Football')",
    "subcategory": "Broader context (e.g., 'Data Structures & Algorithms', 'Classical Mechanics', 'Sports')",
    "advanced_topic": "Most specific topic",
    "difficulty_level": "beginner/intermediate/advanced",
    "related_concepts": ["other concepts in this list that are related"],
    "prerequisites": ["concepts needed before this"],
    "confidence": 0.9
  }},
  ...
]

IMPORTANT: Look at ALL concepts first, identify groups, then classify consistently!

Classify all {len(concepts)} concepts now:"""

        try:
            result_text = self._call_ai(prompt, max_tokens=2000)
            
            # Extract JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            classifications = json.loads(result_text)
            
            # Validate each classification
            validated = []
            for i, classification in enumerate(classifications):
                if not isinstance(classification, dict):
                    continue
                
                # Set defaults
                if not classification.get("category"):
                    classification["category"] = self._infer_category(concepts[i] if i < len(concepts) else "")
                if not classification.get("subcategory"):
                    classification["subcategory"] = self._infer_subcategory(
                        concepts[i] if i < len(concepts) else "", 
                        classification["category"]
                    )
                if not classification.get("advanced_topic"):
                    classification["advanced_topic"] = concepts[i] if i < len(concepts) else ""
                if not classification.get("difficulty_level"):
                    classification["difficulty_level"] = "intermediate"
                if not classification.get("related_concepts"):
                    classification["related_concepts"] = []
                if not classification.get("prerequisites"):
                    classification["prerequisites"] = []
                if not classification.get("confidence"):
                    classification["confidence"] = 0.7
                
                validated.append(classification)
            
            return validated
            
        except Exception as e:
            logger.error(f"Error in batch AI classification: {e}")
            # Fallback: return basic classifications
            return [
                {
                    "category": self._infer_category(name),
                    "subcategory": self._infer_subcategory(name, self._infer_category(name)),
                    "advanced_topic": name,
                    "difficulty_level": "intermediate",
                    "related_concepts": [],
                    "prerequisites": [],
                    "confidence": 0.5
                }
                for name in concepts
            ]
    
    def ai_classify_single_concept(self, concept_name: str, description: str = "") -> Dict[str, Any]:
        """
        Use AI to deeply classify a single concept with maximum specificity
        This is called for EVERY new concept to ensure proper classification
        
        Args:
            concept_name: The concept to classify
            description: Optional description for context
        
        Returns:
            Dict with category, subcategory, advanced_topic, difficulty, and related_concepts
        """
        
        # Build comprehensive context
        all_topics = []
        for cat, data in self.category_hierarchy.items():
            for subcat in data["subcategories"][:5]:
                all_topics.append(f"{cat} → {subcat}")
            for subcat, topics in list(data["advanced_topics"].items())[:3]:
                topics_str = ", ".join(topics[:8])
                all_topics.append(f"{cat} → {subcat} → {topics_str}")
        
        topics_context = "\n".join(all_topics[:30])  # Top 30 most relevant paths
        
        prompt = f"""You are an expert knowledge classifier. Classify this concept with MAXIMUM SPECIFICITY.

CONCEPT: {concept_name}
{f"DESCRIPTION: {description}" if description else ""}

CLASSIFICATION HIERARCHY (be as specific as possible):
{topics_context}

RULES:
1. Be ULTRA-SPECIFIC - Don't say "Algorithms", say "Sorting Algorithms" → "Merge Sort"
2. Use EXACT technical terms - "Dijkstra's Algorithm" not "Graph Algorithm"
3. Identify the MOST SPECIFIC level possible
4. For DSA topics, specify the exact algorithm/data structure
5. For Biology, specify the exact biological process/system
6. For Math, specify the exact mathematical concept

Return ONLY a JSON object:
{{
  "category": "Main category (e.g., Computer Science)",
  "subcategory": "Specific subcategory (e.g., Sorting Algorithms)",
  "advanced_topic": "Most specific topic (e.g., Merge Sort)",
  "difficulty_level": "beginner/intermediate/advanced",
  "related_concepts": ["concept1", "concept2", "concept3"],
  "prerequisites": ["prereq1", "prereq2"],
  "confidence": 0.95
}}

Example for "Merge Sort":
{{
  "category": "Computer Science",
  "subcategory": "Sorting Algorithms",
  "advanced_topic": "Merge Sort",
  "difficulty_level": "intermediate",
  "related_concepts": ["Quick Sort", "Heap Sort", "Divide and Conquer"],
  "prerequisites": ["Recursion", "Arrays"],
  "confidence": 0.98
}}

Classify now:"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,  # Low temperature for consistent classification
                max_tokens=300
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            classification = json.loads(result_text)
            
            # Validate and set defaults
            if not classification.get("category"):
                classification["category"] = self._infer_category(concept_name)
            if not classification.get("subcategory"):
                classification["subcategory"] = self._infer_subcategory(concept_name, classification["category"])
            if not classification.get("advanced_topic"):
                classification["advanced_topic"] = concept_name
            if not classification.get("difficulty_level"):
                classification["difficulty_level"] = "intermediate"
            if not classification.get("related_concepts"):
                classification["related_concepts"] = []
            if not classification.get("prerequisites"):
                classification["prerequisites"] = []
            if not classification.get("confidence"):
                classification["confidence"] = 0.7
            
            return classification
            
        except Exception as e:
            logger.error(f"Error in AI classification: {e}")
            # Fallback to rule-based classification
            return {
                "category": self._infer_category(concept_name),
                "subcategory": self._infer_subcategory(concept_name, self._infer_category(concept_name)),
                "advanced_topic": concept_name,
                "difficulty_level": "intermediate",
                "related_concepts": [],
                "prerequisites": [],
                "confidence": 0.5
            }


# Singleton instance
_concept_agent = None

def get_concept_agent(groq_client=None, model_name: str = "llama-3.3-70b-versatile",
                     gemini_client=None, gemini_model: str = "gemini-2.0-flash", gemini_api_key: str = None):
    """Get or create the concept classification agent singleton"""
    global _concept_agent
    # Always recreate if API key is provided (ensures we use Gemini)
    if gemini_api_key or _concept_agent is None:
        _concept_agent = ConceptClassificationAgent(groq_client, model_name, gemini_client, gemini_model, gemini_api_key)
    return _concept_agent
