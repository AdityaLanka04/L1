"""
Seed Knowledge Graph with Educational Concept Relationships
This script populates the Neo4j Knowledge Graph with:
- Topics (subjects/courses)
- Concepts with prerequisites and relationships
- Domain classifications

Run: python seed_knowledge_graph.py
"""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


# ==================== Educational Data ====================

TOPICS = {
    "Python Programming": {
        "description": "Learn Python from basics to advanced",
        "domain": "Computer Science"
    },
    "Data Structures": {
        "description": "Fundamental data structures and algorithms",
        "domain": "Computer Science"
    },
    "Machine Learning": {
        "description": "Introduction to machine learning concepts",
        "domain": "Artificial Intelligence"
    },
    "Mathematics": {
        "description": "Mathematical foundations for CS and ML",
        "domain": "Mathematics"
    },
    "Web Development": {
        "description": "Frontend and backend web development",
        "domain": "Computer Science"
    },
    "Database Systems": {
        "description": "Relational and NoSQL databases",
        "domain": "Computer Science"
    }
}

# Concepts with their relationships
# Format: concept_name -> {topic, domain, difficulty, prerequisites, related}
CONCEPTS = {
    # Python Programming - Basics
    "Variables": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.1,
        "description": "Storing and naming data values",
        "prerequisites": [],
        "related": ["Data Types", "Assignment Operators"]
    },
    "Data Types": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.15,
        "description": "int, float, string, boolean types",
        "prerequisites": ["Variables"],
        "related": ["Type Conversion", "Variables"]
    },
    "Operators": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.2,
        "description": "Arithmetic, comparison, logical operators",
        "prerequisites": ["Variables", "Data Types"],
        "related": ["Expressions", "Boolean Logic"]
    },
    "Control Flow": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.25,
        "description": "if/else statements and conditionals",
        "prerequisites": ["Operators", "Boolean Logic"],
        "related": ["Loops", "Boolean Logic"]
    },
    "Loops": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.3,
        "description": "for and while loops",
        "prerequisites": ["Control Flow"],
        "related": ["Iteration", "List Comprehension"]
    },
    "Functions": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.35,
        "description": "Defining and calling functions",
        "prerequisites": ["Control Flow", "Variables"],
        "related": ["Parameters", "Return Values", "Scope"]
    },
    "Lists": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.3,
        "description": "Python list data structure",
        "prerequisites": ["Data Types", "Loops"],
        "related": ["Arrays", "Indexing", "Slicing"]
    },
    "Dictionaries": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.35,
        "description": "Key-value pair data structure",
        "prerequisites": ["Data Types", "Lists"],
        "related": ["Hash Tables", "JSON"]
    },
    "Classes": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.5,
        "description": "Object-oriented programming basics",
        "prerequisites": ["Functions", "Data Types"],
        "related": ["Objects", "Inheritance", "Methods"]
    },
    "Inheritance": {
        "topic": "Python Programming",
        "domain": "Computer Science",
        "difficulty": 0.6,
        "description": "Class inheritance and polymorphism",
        "prerequisites": ["Classes"],
        "related": ["Polymorphism", "Abstract Classes"]
    },
    
    # Data Structures
    "Arrays": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.2,
        "description": "Contiguous memory data structure",
        "prerequisites": ["Variables", "Loops"],
        "related": ["Lists", "Indexing"]
    },
    "Linked Lists": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.4,
        "description": "Node-based linear data structure",
        "prerequisites": ["Arrays", "Classes"],
        "related": ["Pointers", "Nodes"]
    },
    "Stacks": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.35,
        "description": "LIFO data structure",
        "prerequisites": ["Arrays", "Lists"],
        "related": ["Queues", "Recursion"]
    },
    "Queues": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.35,
        "description": "FIFO data structure",
        "prerequisites": ["Arrays", "Lists"],
        "related": ["Stacks", "BFS"]
    },
    "Hash Tables": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.5,
        "description": "Key-value storage with hashing",
        "prerequisites": ["Arrays", "Dictionaries"],
        "related": ["Hashing", "Collision Resolution"]
    },
    "Binary Trees": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.55,
        "description": "Hierarchical tree structure",
        "prerequisites": ["Linked Lists", "Recursion"],
        "related": ["BST", "Tree Traversal"]
    },
    "Binary Search Trees": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.6,
        "description": "Ordered binary tree for searching",
        "prerequisites": ["Binary Trees", "Binary Search"],
        "related": ["AVL Trees", "Tree Balancing"]
    },
    "Graphs": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.65,
        "description": "Nodes and edges data structure",
        "prerequisites": ["Linked Lists", "Hash Tables"],
        "related": ["BFS", "DFS", "Adjacency List"]
    },
    "Recursion": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.45,
        "description": "Self-referential problem solving",
        "prerequisites": ["Functions", "Stacks"],
        "related": ["Base Case", "Call Stack"]
    },
    "Binary Search": {
        "topic": "Data Structures",
        "domain": "Computer Science",
        "difficulty": 0.4,
        "description": "Divide and conquer search algorithm",
        "prerequisites": ["Arrays", "Loops"],
        "related": ["Sorting", "Time Complexity"]
    },
    
    # Mathematics
    "Algebra": {
        "topic": "Mathematics",
        "domain": "Mathematics",
        "difficulty": 0.3,
        "description": "Variables, equations, and expressions",
        "prerequisites": [],
        "related": ["Linear Equations", "Polynomials"]
    },
    "Linear Algebra": {
        "topic": "Mathematics",
        "domain": "Mathematics",
        "difficulty": 0.5,
        "description": "Vectors, matrices, and linear transformations",
        "prerequisites": ["Algebra"],
        "related": ["Matrices", "Vectors", "Eigenvalues"]
    },
    "Calculus": {
        "topic": "Mathematics",
        "domain": "Mathematics",
        "difficulty": 0.55,
        "description": "Derivatives and integrals",
        "prerequisites": ["Algebra"],
        "related": ["Derivatives", "Integrals", "Limits"]
    },
    "Probability": {
        "topic": "Mathematics",
        "domain": "Mathematics",
        "difficulty": 0.45,
        "description": "Probability theory and distributions",
        "prerequisites": ["Algebra"],
        "related": ["Statistics", "Distributions", "Bayes Theorem"]
    },
    "Statistics": {
        "topic": "Mathematics",
        "domain": "Mathematics",
        "difficulty": 0.5,
        "description": "Descriptive and inferential statistics",
        "prerequisites": ["Probability", "Algebra"],
        "related": ["Mean", "Variance", "Hypothesis Testing"]
    },
    
    # Machine Learning
    "Supervised Learning": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.5,
        "description": "Learning from labeled data",
        "prerequisites": ["Linear Algebra", "Statistics"],
        "related": ["Classification", "Regression"]
    },
    "Unsupervised Learning": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.55,
        "description": "Learning from unlabeled data",
        "prerequisites": ["Linear Algebra", "Statistics"],
        "related": ["Clustering", "Dimensionality Reduction"]
    },
    "Linear Regression": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.45,
        "description": "Predicting continuous values",
        "prerequisites": ["Supervised Learning", "Calculus"],
        "related": ["Gradient Descent", "Loss Functions"]
    },
    "Logistic Regression": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.5,
        "description": "Binary classification algorithm",
        "prerequisites": ["Linear Regression", "Probability"],
        "related": ["Classification", "Sigmoid Function"]
    },
    "Neural Networks": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.7,
        "description": "Deep learning fundamentals",
        "prerequisites": ["Linear Regression", "Calculus", "Linear Algebra"],
        "related": ["Backpropagation", "Activation Functions"]
    },
    "Decision Trees": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.5,
        "description": "Tree-based classification and regression",
        "prerequisites": ["Supervised Learning"],
        "related": ["Random Forests", "Information Gain"]
    },
    "Clustering": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.5,
        "description": "Grouping similar data points",
        "prerequisites": ["Unsupervised Learning"],
        "related": ["K-Means", "Hierarchical Clustering"]
    },
    "Gradient Descent": {
        "topic": "Machine Learning",
        "domain": "Artificial Intelligence",
        "difficulty": 0.55,
        "description": "Optimization algorithm for ML",
        "prerequisites": ["Calculus", "Linear Regression"],
        "related": ["Learning Rate", "Optimization"]
    },
    
    # Web Development
    "HTML": {
        "topic": "Web Development",
        "domain": "Computer Science",
        "difficulty": 0.15,
        "description": "Structure of web pages",
        "prerequisites": [],
        "related": ["CSS", "DOM"]
    },
    "CSS": {
        "topic": "Web Development",
        "domain": "Computer Science",
        "difficulty": 0.25,
        "description": "Styling web pages",
        "prerequisites": ["HTML"],
        "related": ["Flexbox", "Grid", "Responsive Design"]
    },
    "JavaScript": {
        "topic": "Web Development",
        "domain": "Computer Science",
        "difficulty": 0.4,
        "description": "Client-side programming",
        "prerequisites": ["HTML", "CSS", "Variables"],
        "related": ["DOM Manipulation", "Events", "Async"]
    },
    "React": {
        "topic": "Web Development",
        "domain": "Computer Science",
        "difficulty": 0.55,
        "description": "Component-based UI library",
        "prerequisites": ["JavaScript", "HTML"],
        "related": ["Components", "State", "Props"]
    },
    "REST APIs": {
        "topic": "Web Development",
        "domain": "Computer Science",
        "difficulty": 0.45,
        "description": "HTTP-based web services",
        "prerequisites": ["JavaScript", "HTTP"],
        "related": ["JSON", "CRUD", "Endpoints"]
    },
    
    # Database Systems
    "SQL": {
        "topic": "Database Systems",
        "domain": "Computer Science",
        "difficulty": 0.35,
        "description": "Structured Query Language",
        "prerequisites": ["Data Types"],
        "related": ["SELECT", "JOIN", "Queries"]
    },
    "Database Design": {
        "topic": "Database Systems",
        "domain": "Computer Science",
        "difficulty": 0.5,
        "description": "Schema design and normalization",
        "prerequisites": ["SQL"],
        "related": ["Normalization", "ER Diagrams", "Keys"]
    },
    "NoSQL": {
        "topic": "Database Systems",
        "domain": "Computer Science",
        "difficulty": 0.5,
        "description": "Non-relational databases",
        "prerequisites": ["SQL", "Dictionaries"],
        "related": ["MongoDB", "Document Stores", "Key-Value"]
    },
    "Indexing": {
        "topic": "Database Systems",
        "domain": "Computer Science",
        "difficulty": 0.55,
        "description": "Database performance optimization",
        "prerequisites": ["SQL", "Binary Search Trees"],
        "related": ["B-Trees", "Query Optimization"]
    }
}


async def seed_knowledge_graph():
    """Seed the knowledge graph with educational data"""
    print("\n" + "="*60)
    print("🌱 SEEDING KNOWLEDGE GRAPH")
    print("="*60)
    
    try:
        from knowledge_graph import get_knowledge_graph, create_user_knowledge_graph
        from database import SessionLocal
        
        # Connect to Neo4j
        neo4j_client = await get_knowledge_graph()
        if not neo4j_client:
            print("❌ Neo4j not available")
            return False
        
        print("✅ Connected to Neo4j")
        
        user_kg = create_user_knowledge_graph(neo4j_client, SessionLocal)
        
        # Step 1: Create Topics
        print("\n📚 Creating Topics...")
        for topic_name, topic_data in TOPICS.items():
            query = """
            MERGE (t:Topic {name: $name})
            SET t.description = $description,
                t.domain = $domain
            """
            async with neo4j_client.session() as session:
                await session.run(query, {
                    "name": topic_name,
                    "description": topic_data["description"],
                    "domain": topic_data["domain"]
                })
            print(f"   ✅ {topic_name}")
        
        # Step 2: Create Concepts with Relationships
        print("\n🧠 Creating Concepts and Relationships...")
        
        # First pass: Create all concepts
        for concept_name, concept_data in CONCEPTS.items():
            query = """
            MERGE (c:Concept {name: $name})
            SET c.domain = $domain,
                c.difficulty = $difficulty,
                c.description = $description,
                c.keywords = [$name]
            """
            async with neo4j_client.session() as session:
                await session.run(query, {
                    "name": concept_name,
                    "domain": concept_data["domain"],
                    "difficulty": concept_data["difficulty"],
                    "description": concept_data.get("description", "")
                })
        
        print(f"   ✅ Created {len(CONCEPTS)} concepts")
        
        # Second pass: Create relationships
        prereq_count = 0
        related_count = 0
        topic_count = 0
        
        for concept_name, concept_data in CONCEPTS.items():
            # Link to topic
            if concept_data.get("topic"):
                query = """
                MATCH (c:Concept {name: $concept})
                MATCH (t:Topic {name: $topic})
                MERGE (c)-[:PART_OF]->(t)
                """
                async with neo4j_client.session() as session:
                    await session.run(query, {
                        "concept": concept_name,
                        "topic": concept_data["topic"]
                    })
                topic_count += 1
            
            # Create prerequisite relationships
            for prereq in concept_data.get("prerequisites", []):
                if prereq in CONCEPTS:  # Only if prereq exists
                    query = """
                    MATCH (prereq:Concept {name: $prereq})
                    MATCH (concept:Concept {name: $concept})
                    MERGE (prereq)-[:PREREQUISITE_OF]->(concept)
                    """
                    async with neo4j_client.session() as session:
                        await session.run(query, {
                            "prereq": prereq,
                            "concept": concept_name
                        })
                    prereq_count += 1
            
            # Create related relationships
            for related in concept_data.get("related", []):
                if related in CONCEPTS:  # Only if related exists
                    query = """
                    MATCH (c1:Concept {name: $concept1})
                    MATCH (c2:Concept {name: $concept2})
                    MERGE (c1)-[:RELATED_TO]-(c2)
                    """
                    async with neo4j_client.session() as session:
                        await session.run(query, {
                            "concept1": concept_name,
                            "concept2": related
                        })
                    related_count += 1
        
        print(f"   ✅ Created {prereq_count} prerequisite relationships")
        print(f"   ✅ Created {related_count} related relationships")
        print(f"   ✅ Linked {topic_count} concepts to topics")
        
        # Verify
        print("\n📊 Verification...")
        
        async with neo4j_client.session() as session:
            # Count nodes
            result = await session.run("MATCH (t:Topic) RETURN count(t) as count")
            record = await result.single()
            print(f"   Topics: {record['count']}")
            
            result = await session.run("MATCH (c:Concept) RETURN count(c) as count")
            record = await result.single()
            print(f"   Concepts: {record['count']}")
            
            # Count relationships
            result = await session.run("MATCH ()-[r:PREREQUISITE_OF]->() RETURN count(r) as count")
            record = await result.single()
            print(f"   PREREQUISITE_OF: {record['count']}")
            
            result = await session.run("MATCH ()-[r:PART_OF]->() RETURN count(r) as count")
            record = await result.single()
            print(f"   PART_OF: {record['count']}")
            
            result = await session.run("MATCH ()-[r:RELATED_TO]-() RETURN count(r) as count")
            record = await result.single()
            print(f"   RELATED_TO: {record['count']}")
        
        print("\n✅ Knowledge Graph seeded successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_advanced_features():
    """Test the advanced KG features after seeding"""
    print("\n" + "="*60)
    print("🧪 TESTING ADVANCED FEATURES")
    print("="*60)
    
    try:
        from knowledge_graph import get_knowledge_graph, create_user_knowledge_graph
        from database import SessionLocal
        
        neo4j_client = await get_knowledge_graph()
        user_kg = create_user_knowledge_graph(neo4j_client, SessionLocal)
        
        TEST_USER_ID = 1
        
        # First, record some concept interactions to build user knowledge
        print("\n📝 Recording sample concept interactions...")
        test_interactions = [
            ("Variables", True, 0.1),
            ("Variables", True, 0.1),
            ("Data Types", True, 0.15),
            ("Data Types", True, 0.15),
            ("Operators", True, 0.2),
            ("Control Flow", False, 0.25),
            ("Loops", False, 0.3),
            ("Algebra", True, 0.3),
            ("Algebra", True, 0.3),
            ("HTML", True, 0.15),
            ("CSS", True, 0.25),
        ]
        
        for concept, correct, difficulty in test_interactions:
            await user_kg.record_concept_interaction(
                user_id=TEST_USER_ID,
                concept=concept,
                correct=correct,
                source="seed_test",
                difficulty=difficulty
            )
        print(f"   Recorded {len(test_interactions)} interactions")
        
        # Test 1: Learning Path
        print("\n📝 Test 1: Learning Path for 'Python Programming'")
        path = await user_kg.get_learning_path(TEST_USER_ID, "Python Programming", max_concepts=5)
        print(f"   Topic: {path.topic}")
        print(f"   Estimated time: {path.estimated_time_hours} hours")
        print(f"   Prerequisites met: {path.prerequisites_met}")
        if path.concepts:
            print(f"   Concepts to learn:")
            for c in path.concepts[:5]:
                print(f"      - {c['name']} (difficulty: {c['difficulty']}, mastery: {c['current_mastery']:.2f})")
        
        # Test 2: Knowledge Gaps
        print("\n📝 Test 2: Knowledge Gaps")
        gaps = await user_kg.find_knowledge_gaps(TEST_USER_ID, limit=5)
        if gaps:
            print(f"   Found {len(gaps)} knowledge gaps:")
            for gap in gaps:
                print(f"      - {gap['concept']}: {gap.get('reason', 'Ready to learn')}")
        else:
            print("   No gaps found (need more mastered concepts)")
        
        # Test 3: Recommended Topics
        print("\n📝 Test 3: Recommended Topics")
        topics = await user_kg.get_recommended_topics(TEST_USER_ID, limit=3)
        if topics:
            print(f"   Found {len(topics)} recommended topics:")
            for t in topics:
                print(f"      - {t['topic']}: {t.get('recommendation_reason', 'Continue learning')}")
        else:
            print("   No recommendations yet")
        
        # Test 4: Related Concepts
        print("\n📝 Test 4: Related Concepts for 'Functions'")
        related = await user_kg.get_related_concepts("Functions", user_id=TEST_USER_ID, limit=5)
        if related:
            print(f"   Found {len(related)} related concepts:")
            for r in related:
                print(f"      - {r['concept']} (mastery: {r.get('user_mastery', 0):.2f})")
        
        # Test 5: Domain Mastery
        print("\n📝 Test 5: Domain Mastery")
        domains = await user_kg.get_domain_mastery(TEST_USER_ID)
        if domains:
            for domain, data in domains.items():
                print(f"   {domain}: {data['average_mastery']:.2f} ({data['concept_count']} concepts)")
        
        print("\n✅ Advanced features test completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Main function"""
    # Seed the knowledge graph
    success = await seed_knowledge_graph()
    
    if success:
        # Test advanced features
        await test_advanced_features()


if __name__ == "__main__":
    asyncio.run(main())
