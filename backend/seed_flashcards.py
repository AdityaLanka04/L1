"""
Script to seed 100 unique flashcards into the system
"""
import sys
import os
from datetime import datetime
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models import Base, FlashcardSet, Flashcard, User

# 100 unique flashcard data across different subjects
FLASHCARD_DATA = [
    # Computer Science (25 cards)
    {"q": "What is Big O notation?", "a": "A mathematical notation that describes the limiting behavior of a function when the argument tends towards a particular value or infinity, used to classify algorithms by how they respond to changes in input size.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a binary search tree?", "a": "A tree data structure where each node has at most two children, and for each node, all elements in the left subtree are less than the node, and all elements in the right subtree are greater.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is polymorphism in OOP?", "a": "The ability of different objects to respond to the same message or method call in different ways, allowing objects of different types to be treated as objects of a common base type.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a hash table?", "a": "A data structure that implements an associative array, mapping keys to values using a hash function to compute an index into an array of buckets or slots.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is recursion?", "a": "A programming technique where a function calls itself to solve a problem by breaking it down into smaller, similar subproblems.", "category": "Computer Science", "difficulty": "easy"},
    {"q": "What is the difference between stack and heap memory?", "a": "Stack memory is used for static memory allocation (local variables, function calls) with automatic management, while heap memory is used for dynamic memory allocation with manual management.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a RESTful API?", "a": "An architectural style for designing networked applications using HTTP requests to access and manipulate data, following principles like statelessness, client-server architecture, and uniform interface.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is SQL injection?", "a": "A code injection technique that exploits security vulnerabilities in an application's database layer by inserting malicious SQL statements into entry fields.", "category": "Computer Science", "difficulty": "hard"},
    {"q": "What is the CAP theorem?", "a": "A theorem stating that a distributed data store can only provide two out of three guarantees: Consistency, Availability, and Partition tolerance.", "category": "Computer Science", "difficulty": "hard"},
    {"q": "What is a deadlock?", "a": "A situation in concurrent programming where two or more processes are unable to proceed because each is waiting for the other to release a resource.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is time complexity of quicksort?", "a": "Average case: O(n log n), Worst case: O(n²), Best case: O(n log n)", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is encapsulation?", "a": "The bundling of data and methods that operate on that data within a single unit (class), restricting direct access to some components.", "category": "Computer Science", "difficulty": "easy"},
    {"q": "What is a linked list?", "a": "A linear data structure where elements are stored in nodes, and each node points to the next node in the sequence.", "category": "Computer Science", "difficulty": "easy"},
    {"q": "What is the difference between TCP and UDP?", "a": "TCP is connection-oriented, reliable, and ensures ordered delivery. UDP is connectionless, faster, but doesn't guarantee delivery or order.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a closure in programming?", "a": "A function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is normalization in databases?", "a": "The process of organizing data in a database to reduce redundancy and improve data integrity by dividing large tables into smaller ones and defining relationships.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is the difference between process and thread?", "a": "A process is an independent program in execution with its own memory space. A thread is a lightweight unit of execution within a process, sharing the process's memory.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a design pattern?", "a": "A reusable solution to a commonly occurring problem in software design, providing a template for how to solve a problem in various situations.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is garbage collection?", "a": "An automatic memory management process that identifies and frees memory that is no longer in use by the program.", "category": "Computer Science", "difficulty": "easy"},
    {"q": "What is the MVC pattern?", "a": "Model-View-Controller: an architectural pattern that separates an application into three interconnected components - Model (data), View (UI), and Controller (logic).", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is Docker?", "a": "A platform for developing, shipping, and running applications in containers - lightweight, standalone packages that include everything needed to run software.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is GraphQL?", "a": "A query language for APIs that allows clients to request exactly the data they need, making APIs more flexible and efficient than traditional REST.", "category": "Computer Science", "difficulty": "medium"},
    {"q": "What is a microservice?", "a": "An architectural style that structures an application as a collection of small, loosely coupled, independently deployable services.", "category": "Computer Science", "difficulty": "hard"},
    {"q": "What is OAuth?", "a": "An open standard for access delegation, commonly used for token-based authentication and authorization on the internet.", "category": "Computer Science", "difficulty": "hard"},
    {"q": "What is continuous integration?", "a": "A development practice where developers integrate code into a shared repository frequently, with each integration verified by automated builds and tests.", "category": "Computer Science", "difficulty": "medium"},
    
    # Mathematics (20 cards)
    {"q": "What is the Pythagorean theorem?", "a": "In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides: a² + b² = c²", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is the derivative of sin(x)?", "a": "cos(x)", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is the integral of 1/x?", "a": "ln|x| + C", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is Euler's identity?", "a": "e^(iπ) + 1 = 0", "category": "Mathematics", "difficulty": "hard"},
    {"q": "What is the quadratic formula?", "a": "x = (-b ± √(b² - 4ac)) / 2a", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is a prime number?", "a": "A natural number greater than 1 that has no positive divisors other than 1 and itself.", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is the fundamental theorem of calculus?", "a": "It links the concept of differentiation and integration, stating that differentiation and integration are inverse operations.", "category": "Mathematics", "difficulty": "hard"},
    {"q": "What is a matrix?", "a": "A rectangular array of numbers, symbols, or expressions arranged in rows and columns.", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is the chain rule?", "a": "A formula for computing the derivative of a composite function: (f∘g)'(x) = f'(g(x)) · g'(x)", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is a vector?", "a": "A quantity having both magnitude and direction, represented by an arrow or ordered list of numbers.", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is the binomial theorem?", "a": "A formula for expanding powers of binomials: (x+y)ⁿ = Σ(n choose k)x^(n-k)y^k", "category": "Mathematics", "difficulty": "hard"},
    {"q": "What is a logarithm?", "a": "The inverse operation to exponentiation: if b^y = x, then log_b(x) = y", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is the slope-intercept form?", "a": "y = mx + b, where m is the slope and b is the y-intercept", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is a factorial?", "a": "The product of all positive integers less than or equal to n, denoted n! = n × (n-1) × ... × 2 × 1", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is the distance formula?", "a": "d = √((x₂-x₁)² + (y₂-y₁)²)", "category": "Mathematics", "difficulty": "easy"},
    {"q": "What is a complex number?", "a": "A number of the form a + bi, where a and b are real numbers and i is the imaginary unit (i² = -1)", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is the mean value theorem?", "a": "If f is continuous on [a,b] and differentiable on (a,b), there exists c in (a,b) where f'(c) = (f(b)-f(a))/(b-a)", "category": "Mathematics", "difficulty": "hard"},
    {"q": "What is a geometric series?", "a": "A series where each term is found by multiplying the previous term by a constant ratio r", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is the unit circle?", "a": "A circle with radius 1 centered at the origin, used to define trigonometric functions", "category": "Mathematics", "difficulty": "medium"},
    {"q": "What is a permutation?", "a": "An arrangement of objects in a specific order, calculated as P(n,r) = n!/(n-r)!", "category": "Mathematics", "difficulty": "medium"},
    
    # Science (20 cards)
    {"q": "What is Newton's First Law?", "a": "An object at rest stays at rest and an object in motion stays in motion with the same speed and direction unless acted upon by an unbalanced force.", "category": "Physics", "difficulty": "easy"},
    {"q": "What is photosynthesis?", "a": "The process by which plants use sunlight, water, and carbon dioxide to produce oxygen and energy in the form of sugar.", "category": "Biology", "difficulty": "easy"},
    {"q": "What is the speed of light?", "a": "Approximately 299,792,458 meters per second (or about 186,282 miles per second) in a vacuum", "category": "Physics", "difficulty": "medium"},
    {"q": "What is DNA?", "a": "Deoxyribonucleic acid - a molecule that carries genetic instructions for development, functioning, growth, and reproduction of all known organisms.", "category": "Biology", "difficulty": "easy"},
    {"q": "What is the periodic table?", "a": "A tabular arrangement of chemical elements organized by atomic number, electron configuration, and recurring chemical properties.", "category": "Chemistry", "difficulty": "easy"},
    {"q": "What is entropy?", "a": "A measure of disorder or randomness in a system; in thermodynamics, it quantifies the amount of thermal energy unavailable to do work.", "category": "Physics", "difficulty": "hard"},
    {"q": "What is mitosis?", "a": "A type of cell division that results in two daughter cells each having the same number and kind of chromosomes as the parent nucleus.", "category": "Biology", "difficulty": "medium"},
    {"q": "What is an atom?", "a": "The smallest unit of matter that retains the properties of an element, consisting of protons, neutrons, and electrons.", "category": "Chemistry", "difficulty": "easy"},
    {"q": "What is gravity?", "a": "A fundamental force of nature that attracts objects with mass toward each other, described by Newton's law and Einstein's general relativity.", "category": "Physics", "difficulty": "medium"},
    {"q": "What is evolution?", "a": "The process by which different kinds of living organisms develop and diversify from earlier forms through natural selection.", "category": "Biology", "difficulty": "medium"},
    {"q": "What is a chemical bond?", "a": "A lasting attraction between atoms that enables the formation of chemical compounds, including ionic, covalent, and metallic bonds.", "category": "Chemistry", "difficulty": "medium"},
    {"q": "What is kinetic energy?", "a": "The energy an object possesses due to its motion, calculated as KE = ½mv²", "category": "Physics", "difficulty": "easy"},
    {"q": "What is osmosis?", "a": "The movement of water molecules through a semipermeable membrane from an area of lower solute concentration to higher solute concentration.", "category": "Biology", "difficulty": "medium"},
    {"q": "What is pH?", "a": "A measure of acidity or basicity of a solution on a scale of 0-14, where 7 is neutral, below 7 is acidic, and above 7 is basic.", "category": "Chemistry", "difficulty": "easy"},
    {"q": "What is electromagnetic radiation?", "a": "Energy that travels through space as waves, including radio waves, microwaves, infrared, visible light, ultraviolet, X-rays, and gamma rays.", "category": "Physics", "difficulty": "medium"},
    {"q": "What is homeostasis?", "a": "The tendency of biological systems to maintain stable internal conditions despite changes in external environment.", "category": "Biology", "difficulty": "medium"},
    {"q": "What is a catalyst?", "a": "A substance that increases the rate of a chemical reaction without being consumed in the process.", "category": "Chemistry", "difficulty": "medium"},
    {"q": "What is momentum?", "a": "The product of an object's mass and velocity (p = mv), representing the quantity of motion.", "category": "Physics", "difficulty": "easy"},
    {"q": "What is natural selection?", "a": "The process whereby organisms better adapted to their environment tend to survive and produce more offspring.", "category": "Biology", "difficulty": "medium"},
    {"q": "What is an isotope?", "a": "Atoms of the same element that have the same number of protons but different numbers of neutrons.", "category": "Chemistry", "difficulty": "medium"},
    
    # History (15 cards)
    {"q": "When did World War II end?", "a": "1945 (May 8 in Europe, September 2 in the Pacific)", "category": "History", "difficulty": "easy"},
    {"q": "Who wrote the Declaration of Independence?", "a": "Thomas Jefferson (primary author)", "category": "History", "difficulty": "easy"},
    {"q": "What year did the Berlin Wall fall?", "a": "1989", "category": "History", "difficulty": "medium"},
    {"q": "Who was the first President of the United States?", "a": "George Washington", "category": "History", "difficulty": "easy"},
    {"q": "What was the Renaissance?", "a": "A period of cultural, artistic, and intellectual rebirth in Europe from the 14th to 17th century, marking the transition from medieval to modern times.", "category": "History", "difficulty": "medium"},
    {"q": "When did the French Revolution begin?", "a": "1789", "category": "History", "difficulty": "medium"},
    {"q": "What was the Industrial Revolution?", "a": "A period of major industrialization and innovation during the late 18th and early 19th centuries, transforming economies from agrarian to industrial.", "category": "History", "difficulty": "medium"},
    {"q": "Who was Julius Caesar?", "a": "A Roman military general and statesman who played a critical role in the events leading to the demise of the Roman Republic and the rise of the Roman Empire.", "category": "History", "difficulty": "easy"},
    {"q": "What was the Cold War?", "a": "A period of geopolitical tension between the Soviet Union and the United States (and their allies) from 1947 to 1991.", "category": "History", "difficulty": "medium"},
    {"q": "When did Christopher Columbus reach the Americas?", "a": "1492", "category": "History", "difficulty": "easy"},
    {"q": "What was the Magna Carta?", "a": "A charter of rights signed in 1215 that limited the power of the English monarchy and established the principle that everyone is subject to the law.", "category": "History", "difficulty": "medium"},
    {"q": "Who was Cleopatra?", "a": "The last active ruler of the Ptolemaic Kingdom of Egypt, known for her intelligence, political acumen, and relationships with Julius Caesar and Mark Antony.", "category": "History", "difficulty": "medium"},
    {"q": "What was the Great Depression?", "a": "A severe worldwide economic depression that lasted from 1929 to the late 1930s, beginning with the stock market crash of 1929.", "category": "History", "difficulty": "medium"},
    {"q": "When did the American Civil War occur?", "a": "1861-1865", "category": "History", "difficulty": "easy"},
    {"q": "What was the Silk Road?", "a": "An ancient network of trade routes connecting the East and West, facilitating cultural, commercial, and technological exchange.", "category": "History", "difficulty": "medium"},
    
    # Geography & General Knowledge (20 cards)
    {"q": "What is the capital of France?", "a": "Paris", "category": "Geography", "difficulty": "easy"},
    {"q": "How many continents are there?", "a": "Seven: Africa, Antarctica, Asia, Europe, North America, Oceania, and South America", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the largest ocean?", "a": "The Pacific Ocean", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the tallest mountain in the world?", "a": "Mount Everest (8,849 meters or 29,032 feet)", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the longest river in the world?", "a": "The Nile River (though the Amazon is sometimes considered longer depending on measurement)", "category": "Geography", "difficulty": "medium"},
    {"q": "How many countries are in the United Nations?", "a": "193 member states (as of 2024)", "category": "General Knowledge", "difficulty": "medium"},
    {"q": "What is the smallest country in the world?", "a": "Vatican City", "category": "Geography", "difficulty": "medium"},
    {"q": "What is the largest desert in the world?", "a": "Antarctica (cold desert); Sahara (hot desert)", "category": "Geography", "difficulty": "medium"},
    {"q": "What is the currency of Japan?", "a": "Japanese Yen (¥)", "category": "General Knowledge", "difficulty": "easy"},
    {"q": "How many time zones does Russia have?", "a": "11 time zones", "category": "Geography", "difficulty": "hard"},
    {"q": "What is the Great Barrier Reef?", "a": "The world's largest coral reef system, located off the coast of Queensland, Australia", "category": "Geography", "difficulty": "medium"},
    {"q": "What is the population of Earth?", "a": "Approximately 8 billion people (as of 2024)", "category": "General Knowledge", "difficulty": "medium"},
    {"q": "What is the deepest point in the ocean?", "a": "Challenger Deep in the Mariana Trench (approximately 11,000 meters or 36,000 feet)", "category": "Geography", "difficulty": "hard"},
    {"q": "What is the Aurora Borealis?", "a": "The Northern Lights - a natural light display in Earth's sky caused by solar wind interacting with the magnetosphere.", "category": "Science", "difficulty": "medium"},
    {"q": "What is the Equator?", "a": "An imaginary line around Earth's middle at 0° latitude, dividing it into Northern and Southern Hemispheres.", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the International Date Line?", "a": "An imaginary line on Earth's surface at roughly 180° longitude where the date changes by one day when crossed.", "category": "Geography", "difficulty": "medium"},
    {"q": "What is the Amazon Rainforest?", "a": "The world's largest tropical rainforest, located in South America, covering much of the Amazon basin.", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the Sahara Desert?", "a": "The largest hot desert in the world, covering most of North Africa", "category": "Geography", "difficulty": "easy"},
    {"q": "What is the Ring of Fire?", "a": "A major area in the Pacific Ocean basin where many earthquakes and volcanic eruptions occur due to tectonic plate boundaries.", "category": "Geography", "difficulty": "medium"},
    {"q": "What is the Greenwich Mean Time (GMT)?", "a": "The mean solar time at the Royal Observatory in Greenwich, London, used as the basis for calculating time zones worldwide.", "category": "General Knowledge", "difficulty": "medium"},
]


def create_flashcard_set_with_cards(db: Session, user_id: int, title: str, description: str, flashcards_data: list):
    """Create a flashcard set and add flashcards to it"""
    
    # Create the flashcard set
    flashcard_set = FlashcardSet(
        user_id=user_id,
        title=title,
        description=description,
        source_type="seeded",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(flashcard_set)
    db.commit()
    db.refresh(flashcard_set)
    
    print(f"✅ Created flashcard set: {title} (ID: {flashcard_set.id})")
    
    # Add flashcards to the set
    for idx, card_data in enumerate(flashcards_data, 1):
        flashcard = Flashcard(
            set_id=flashcard_set.id,
            question=card_data["q"],
            answer=card_data["a"],
            difficulty=card_data.get("difficulty", "medium"),
            category=card_data.get("category", "general"),
            times_reviewed=0,
            correct_count=0,
            marked_for_review=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(flashcard)
        
        if idx % 10 == 0:
            print(f"  Added {idx} flashcards...")
    
    db.commit()
    print(f"✅ Added {len(flashcards_data)} flashcards to set '{title}'")
    
    return flashcard_set


def seed_flashcards(user_id: int = 1):
    """Seed 100 flashcards into the database"""
    
    # Create tables if they don't exist
    print("🔧 Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")
    
    db = SessionLocal()
    
    try:
        # Check if user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"❌ User with ID {user_id} not found!")
            print("Available users:")
            users = db.query(User).all()
            for u in users:
                print(f"  - ID: {u.id}, Username: {u.username}, Email: {u.email}")
            return
        
        print(f"\n🎯 Seeding flashcards for user: {user.username} (ID: {user_id})")
        print("=" * 60)
        
        # Create flashcard set with all 100 cards
        flashcard_set = create_flashcard_set_with_cards(
            db=db,
            user_id=user_id,
            title="Comprehensive Study Collection - 100 Cards",
            description="A diverse collection of 100 flashcards covering Computer Science, Mathematics, Science, History, and Geography",
            flashcards_data=FLASHCARD_DATA
        )
        
        print("\n" + "=" * 60)
        print(f"🎉 Successfully seeded {len(FLASHCARD_DATA)} flashcards!")
        print(f"📚 Flashcard Set ID: {flashcard_set.id}")
        print(f"📝 Title: {flashcard_set.title}")
        print("\nBreakdown by category:")
        
        # Count by category
        category_counts = {}
        for card in FLASHCARD_DATA:
            cat = card.get("category", "general")
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        for category, count in sorted(category_counts.items()):
            print(f"  - {category}: {count} cards")
        
    except Exception as e:
        print(f"❌ Error seeding flashcards: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed 100 flashcards into the database")
    parser.add_argument("--user-id", type=int, default=1, help="User ID to assign flashcards to (default: 1)")
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("🚀 FLASHCARD SEEDING SCRIPT")
    print("=" * 60)
    
    seed_flashcards(user_id=args.user_id)
