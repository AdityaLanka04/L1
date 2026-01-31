# Learning Path System - Requirements Document

## Overview
A Duolingo-style progressive learning path system that creates personalized roadmaps based on user's learning history. Each node represents a learning milestone with specific tasks that must be completed before unlocking the next node.

## Feature Name
`learning-path-system`

## Problem Statement
Currently, the Knowledge Roadmap allows free exploration but lacks structured progression and task completion tracking. Users need a guided learning experience with clear objectives, mandatory tasks, and visible progress to maintain motivation and ensure comprehensive learning.

## User Stories

### US-1: Automatic Learning Path Generation
**As a** student  
**I want** the system to automatically generate a learning path based on my study history  
**So that** I have a personalized curriculum without manual setup

**Acceptance Criteria:**
- AC-1.1: System analyzes user's notes, flashcards, quiz history, and weak areas
- AC-1.2: Generates a hierarchical learning path with 3-5 levels of depth
- AC-1.3: Each node represents a specific topic or skill
- AC-1.4: Path prioritizes weak areas and builds on mastered concepts
- AC-1.5: User can view the generated path in a visual tree/flow diagram

### US-2: Node Task Requirements
**As a** student  
**I want** each learning node to have specific tasks I must complete  
**So that** I thoroughly learn each topic before moving forward

**Acceptance Criteria:**
- AC-2.1: Each node contains 2-5 required tasks from: flashcards, quiz, notes, test, reading
- AC-2.2: Tasks are generated based on available content and learning objectives
- AC-2.3: Node displays task list with completion status (incomplete/in-progress/complete)
- AC-2.4: User can click on a task to start it directly from the node
- AC-2.5: Completed tasks are visually marked with checkmarks and timestamps

### US-3: Progressive Node Unlocking
**As a** student  
**I want** nodes to unlock only after completing all tasks in the current node  
**So that** I follow a structured learning sequence

**Acceptance Criteria:**
- AC-3.1: Initially, only the first node (or root nodes) are unlocked
- AC-3.2: Locked nodes are visually distinct (grayed out, locked icon)
- AC-3.3: Node unlocks automatically when all required tasks are completed
- AC-3.4: User receives a notification/animation when a new node unlocks
- AC-3.5: User can see which tasks remain to unlock the next node
- AC-3.6: System prevents access to locked node tasks

### US-4: Task Types and Execution
**As a** student  
**I want** to complete different types of learning tasks within each node  
**So that** I engage with the material in multiple ways

**Acceptance Criteria:**
- AC-4.1: **Flashcard Task**: Review X flashcards with Y% accuracy
- AC-4.2: **Quiz Task**: Complete a quiz with Z questions and pass threshold
- AC-4.3: **Notes Task**: Create or review notes with minimum word count
- AC-4.4: **Test Task**: Pass a comprehensive test with 70%+ score
- AC-4.5: **Reading Task**: Read AI-generated content or uploaded materials
- AC-4.6: Each task type has clear completion criteria
- AC-4.7: Tasks integrate with existing features (flashcards, quizzes, notes)

### US-5: Progress Tracking and Visualization
**As a** student  
**I want** to see my overall progress through the learning path  
**So that** I stay motivated and understand how much I've accomplished

**Acceptance Criteria:**
- AC-5.1: Dashboard shows overall path completion percentage
- AC-5.2: Visual path displays completed nodes in distinct color (e.g., green)
- AC-5.3: Current active node is highlighted
- AC-5.4: Progress bar shows completion within current node
- AC-5.5: Statistics show: nodes completed, tasks completed, time spent
- AC-5.6: User can view completion history and timestamps

### US-6: Path Customization and Flexibility
**As a** student  
**I want** to customize my learning path or skip certain nodes  
**So that** I can adapt the path to my needs

**Acceptance Criteria:**
- AC-6.1: User can manually add custom nodes to the path
- AC-6.2: User can take a "placement test" to skip mastered nodes
- AC-6.3: User can mark a node as "already mastered" with confirmation
- AC-6.4: System allows creating multiple learning paths for different subjects
- AC-6.5: User can pause/resume a learning path
- AC-6.6: User can reset a path to start over

### US-7: Gamification and Motivation
**As a** student  
**I want** rewards and achievements for completing nodes  
**So that** I stay motivated throughout the learning journey

**Acceptance Criteria:**
- AC-7.1: User earns XP/points for completing tasks and nodes
- AC-7.2: Streak tracking for consecutive days of path progress
- AC-7.3: Achievements unlock at milestones (25%, 50%, 75%, 100% completion)
- AC-7.4: Visual celebrations when completing nodes (animations, confetti)
- AC-7.5: Leaderboard integration for competitive users
- AC-7.6: Daily goals tied to learning path progress

### US-8: Adaptive Difficulty and Content
**As a** student  
**I want** the system to adjust task difficulty based on my performance  
**So that** I'm appropriately challenged without being overwhelmed

**Acceptance Criteria:**
- AC-8.1: System tracks performance on each task type
- AC-8.2: Subsequent tasks adjust difficulty based on previous results
- AC-8.3: If user fails a task multiple times, system offers hints or easier alternatives
- AC-8.4: High performers get bonus/optional challenge tasks
- AC-8.5: System recommends review nodes if performance drops

### US-9: Mobile-Responsive Path Interface
**As a** student  
**I want** to access and complete my learning path on mobile devices  
**So that** I can learn on-the-go

**Acceptance Criteria:**
- AC-9.1: Learning path visualization adapts to mobile screen sizes
- AC-9.2: Touch-friendly node interactions
- AC-9.3: Task completion works seamlessly on mobile
- AC-9.4: Progress syncs across devices in real-time
- AC-9.5: Mobile-optimized task interfaces

### US-10: Integration with Existing Features
**As a** student  
**I want** the learning path to leverage my existing content  
**So that** I don't have to recreate materials

**Acceptance Criteria:**
- AC-10.1: System uses existing flashcard sets for flashcard tasks
- AC-10.2: System generates quizzes from existing notes and slides
- AC-10.3: Notes tasks link to existing note editor
- AC-10.4: System references uploaded slides and media files
- AC-10.5: Knowledge graph integration for topic relationships
- AC-10.6: Weak areas from analytics inform path generation

## Technical Requirements

### TR-1: Database Schema
- New tables: `learning_paths`, `learning_path_nodes`, `node_tasks`, `task_completions`, `path_progress`
- Relationships with existing tables: users, flashcard_sets, question_sets, notes, topic_mastery

### TR-2: API Endpoints
- `POST /api/learning-paths/generate` - Generate path from user data
- `GET /api/learning-paths/{path_id}` - Retrieve path with nodes
- `POST /api/learning-paths/{path_id}/nodes/{node_id}/tasks/{task_id}/complete` - Mark task complete
- `GET /api/learning-paths/{path_id}/progress` - Get progress statistics
- `POST /api/learning-paths/{path_id}/nodes/{node_id}/unlock` - Manual unlock (admin/skip)

### TR-3: Frontend Components
- `LearningPathDashboard` - Main path visualization
- `PathNode` - Individual node component with task list
- `TaskCard` - Task display and interaction
- `ProgressTracker` - Progress visualization
- `PathGenerator` - Initial path creation wizard

### TR-4: Performance Requirements
- Path generation completes within 10 seconds
- Node unlock happens in real-time (<1 second)
- Supports paths with up to 100 nodes
- Handles concurrent task completions

### TR-5: AI/ML Integration
- Use existing AI agents to generate task content
- Leverage adaptive learning engine for difficulty adjustment
- Integrate with RAG system for reading materials
- Use NLP for content analysis and path generation


