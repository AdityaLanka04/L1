import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Briefcase, BookOpen, CheckSquare, Users, Trash2, AlertCircle } from 'lucide-react';
import './Templates.css';

const BUILT_IN_TEMPLATES = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Professional meeting documentation with action items',
    icon: Users,
    category: 'work',
    content: `# Meeting Notes

**Date:** {{date}}
**Time:** {{time}}
**Location:** [Conference Room / Virtual]
**Attendees:** 
- {{user}}
- [Name, Title]
- [Name, Title]

**Meeting Objective:**
[Brief description of meeting purpose]

---

## Agenda Items

### 1. [Topic Name]
**Presenter:** [Name]
**Time Allocated:** [X minutes]

**Discussion Points:**
- 
- 

**Decisions Made:**
- 

### 2. [Topic Name]
**Presenter:** [Name]
**Time Allocated:** [X minutes]

**Discussion Points:**
- 
- 

**Decisions Made:**
- 

---

## Action Items

| Task | Owner | Due Date | Priority | Status |
|------|-------|----------|----------|--------|
| [Action item description] | [Name] | [Date] | High/Medium/Low | Not Started |
| | | | | |

---

## Key Takeaways
- 
- 
- 

## Next Meeting
**Date:** [Date]
**Time:** [Time]
**Agenda:** [Brief description]

## Notes & Comments
[Additional notes, concerns, or follow-up items]
`
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Comprehensive project planning and requirements document',
    icon: Briefcase,
    category: 'work',
    content: `# Project Brief: [Project Name]

**Project Manager:** {{user}}
**Date Created:** {{date}}
**Last Updated:** {{date}}
**Status:** Planning / In Progress / On Hold / Completed

---

## Executive Summary
[2-3 sentence overview of the project, its purpose, and expected outcomes]

---

## Project Overview

### Background
[Context and reasoning behind the project]

### Objectives
1. [Primary objective]
2. [Secondary objective]
3. [Additional objectives]

### Success Criteria
- [ ] [Measurable success metric]
- [ ] [Measurable success metric]
- [ ] [Measurable success metric]

---

## Scope

### In Scope
- [Deliverable or feature]
- [Deliverable or feature]
- [Deliverable or feature]

### Out of Scope
- [Explicitly excluded items]
- [Explicitly excluded items]

---

## Stakeholders

| Name | Role | Responsibility | Contact |
|------|------|----------------|---------|
| [Name] | Project Sponsor | Final approval, budget | [Email] |
| [Name] | Project Manager | Day-to-day management | [Email] |
| [Name] | Team Lead | Technical delivery | [Email] |

---

## Timeline & Milestones

| Milestone | Description | Target Date | Status |
|-----------|-------------|-------------|--------|
| Project Kickoff | Initial team meeting | [Date] | |
| Requirements Complete | All requirements documented | [Date] | |
| Design Phase Complete | Designs approved | [Date] | |
| Development Complete | Code complete | [Date] | |
| Testing Complete | QA signed off | [Date] | |
| Launch | Go-live date | [Date] | |

---

## Resources

### Team Members
- [Name] - [Role]
- [Name] - [Role]

### Budget
**Total Budget:** $[Amount]
**Allocated:**
- Personnel: $[Amount]
- Tools/Software: $[Amount]
- Other: $[Amount]

### Tools & Technology
- [Tool/Platform name]
- [Tool/Platform name]

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| [Risk description] | High/Medium/Low | High/Medium/Low | [How to address] |
| | | | |

---

## Dependencies
- [External dependency or blocker]
- [External dependency or blocker]

---

## Communication Plan
**Status Updates:** [Frequency and format]
**Stakeholder Meetings:** [Schedule]
**Reporting:** [What, when, to whom]

---

## Approval

**Approved by:** _____________________ **Date:** _____
**Approved by:** _____________________ **Date:** _____
`
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Agile sprint planning and tracking template',
    icon: Calendar,
    category: 'work',
    content: `# Sprint Planning - Sprint [Number]

**Sprint Duration:** [Start Date] - [End Date]
**Sprint Goal:** [One sentence describing the sprint objective]
**Scrum Master:** {{user}}
**Product Owner:** [Name]
**Team:** [Team name]

---

## Sprint Capacity

**Team Capacity:** [Total story points / hours]
**Planned Velocity:** [Expected story points]
**Previous Sprint Velocity:** [Actual from last sprint]

**Team Availability:**
| Team Member | Availability | Capacity |
|-------------|--------------|----------|
| [Name] | [Days/Hours] | [Points] |
| [Name] | [Days/Hours] | [Points] |

---

## Sprint Backlog

### High Priority
- [ ] **[Story ID]** [Story title] - [Points] - Assigned: [Name]
  - Acceptance Criteria: [Brief description]
  - Dependencies: [Any blockers]

- [ ] **[Story ID]** [Story title] - [Points] - Assigned: [Name]
  - Acceptance Criteria: [Brief description]
  - Dependencies: [Any blockers]

### Medium Priority
- [ ] **[Story ID]** [Story title] - [Points] - Assigned: [Name]
- [ ] **[Story ID]** [Story title] - [Points] - Assigned: [Name]

### Technical Debt / Bugs
- [ ] **[Bug ID]** [Bug description] - [Points] - Assigned: [Name]

---

## Definition of Done
- [ ] Code complete and peer reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] Product Owner acceptance

---

## Sprint Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk description] | High/Medium/Low | [Action plan] |

---

## Daily Standup Notes

### Day 1 - {{date}}
**Completed Yesterday:**
- 

**Today's Plan:**
- 

**Blockers:**
- 

---

## Sprint Review Notes
**Date:** [End date]
**Completed Stories:** [Number]
**Incomplete Stories:** [Number]
**Velocity Achieved:** [Points]

**Demo Items:**
1. 
2. 

**Feedback:**
- 

---

## Sprint Retrospective

**What Went Well:**
- 
- 

**What Could Be Improved:**
- 
- 

**Action Items for Next Sprint:**
- [ ] 
- [ ] 
`
  },
  {
    id: 'weekly-status',
    name: 'Weekly Status Report',
    description: 'Professional weekly progress and status update',
    icon: FileText,
    category: 'work',
    content: `# Weekly Status Report

**Week of:** {{date}}
**Submitted by:** {{user}}
**Department/Team:** [Team name]
**Report Date:** {{date}}

---

## Executive Summary
[2-3 sentences summarizing the week's key achievements, challenges, and upcoming priorities]

---

## Key Accomplishments

### Completed This Week
1. **[Project/Task Name]**
   - Status: ✅ Completed
   - Impact: [Brief description of business value]
   - Stakeholders: [Names]

2. **[Project/Task Name]**
   - Status: ✅ Completed
   - Impact: [Brief description of business value]
   - Stakeholders: [Names]

3. **[Project/Task Name]**
   - Status: ✅ Completed
   - Impact: [Brief description of business value]
   - Stakeholders: [Names]

---

## In Progress

| Project/Task | Progress | Expected Completion | Status |
|--------------|----------|---------------------|--------|
| [Task name] | 75% | [Date] | 🟢 On Track |
| [Task name] | 50% | [Date] | 🟡 At Risk |
| [Task name] | 25% | [Date] | 🔴 Blocked |

**Status Legend:**
- 🟢 On Track - No issues
- 🟡 At Risk - Potential delays or issues
- 🔴 Blocked - Requires immediate attention

---

## Challenges & Blockers

### Critical Issues
1. **[Issue Description]**
   - Impact: [How it affects the project]
   - Action Needed: [What's required to resolve]
   - Owner: [Who's responsible]
   - Target Resolution: [Date]

### Minor Issues
- [Issue description and status]

---

## Metrics & KPIs

| Metric | Target | Actual | Trend |
|--------|--------|--------|-------|
| [Metric name] | [Value] | [Value] | ↑ / ↓ / → |
| [Metric name] | [Value] | [Value] | ↑ / ↓ / → |
| [Metric name] | [Value] | [Value] | ↑ / ↓ / → |

---

## Next Week's Priorities

### High Priority
1. [Task/Project name] - [Expected outcome]
2. [Task/Project name] - [Expected outcome]
3. [Task/Project name] - [Expected outcome]

### Medium Priority
- [Task/Project name]
- [Task/Project name]

---

## Resource Needs
- [ ] [Resource or support needed]
- [ ] [Resource or support needed]

---

## Upcoming Deadlines
| Item | Due Date | Status |
|------|----------|--------|
| [Deliverable] | [Date] | [Status] |
| [Deliverable] | [Date] | [Status] |

---

## Team Updates
**Team Morale:** [High / Good / Needs Attention]
**Staffing Changes:** [Any changes or needs]
**Training/Development:** [Any activities or needs]

---

## Additional Notes
[Any other relevant information, concerns, or updates]
`
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting Template',
    description: 'Structured one-on-one meeting agenda and notes',
    icon: Users,
    category: 'work',
    content: `# 1:1 Meeting Notes

**Date:** {{date}}
**Manager:** [Manager name]
**Team Member:** {{user}}
**Meeting Duration:** [30/60 minutes]

---

## Check-in
**How are you doing?** (Personal & Professional)
- 

**Current Workload:** Manageable / Busy / Overwhelmed
**Energy Level:** High / Medium / Low

---

## Progress Updates

### Current Projects
1. **[Project Name]**
   - Status: [On track / At risk / Blocked]
   - Progress: [Brief update]
   - Challenges: [Any issues]
   - Support Needed: [What would help]

2. **[Project Name]**
   - Status: [On track / At risk / Blocked]
   - Progress: [Brief update]
   - Challenges: [Any issues]
   - Support Needed: [What would help]

---

## Wins & Accomplishments
**Recent Achievements:**
- 
- 

**Positive Feedback Received:**
- 

---

## Challenges & Concerns

### Work-Related
- [Challenge or concern]
  - Impact: [How it's affecting work]
  - Possible Solutions: [Ideas]

### Team/Process
- [Challenge or concern]
  - Impact: [How it's affecting work]
  - Possible Solutions: [Ideas]

---

## Career Development

**Short-term Goals (3-6 months):**
- [ ] [Goal]
- [ ] [Goal]

**Long-term Goals (1-2 years):**
- [ ] [Goal]
- [ ] [Goal]

**Skills to Develop:**
- [Skill] - [How to develop it]
- [Skill] - [How to develop it]

**Learning Opportunities:**
- [Course, training, or project]

---

## Feedback

### Feedback for Team Member
**What's Going Well:**
- 
- 

**Areas for Growth:**
- 
- 

**Specific Examples:**
- 

### Feedback for Manager
**What's Working:**
- 

**What Could Be Better:**
- 

**Support Needed:**
- 

---

## Action Items

| Action Item | Owner | Due Date | Priority |
|-------------|-------|----------|----------|
| [Action description] | [Name] | [Date] | High/Medium/Low |
| | | | |

---

## Topics for Next Meeting
- [ ] [Topic]
- [ ] [Topic]
- [ ] [Topic]

---

## Next Meeting
**Date:** [Date]
**Time:** [Time]
**Focus:** [Main topic or theme]

---

## Private Notes
[Manager's private observations and notes]
`
  },
  {
    id: 'product-requirements',
    name: 'Product Requirements (PRD)',
    description: 'Detailed product requirements document',
    icon: BookOpen,
    category: 'work',
    content: `# Product Requirements Document

**Product Name:** [Product/Feature Name]
**Document Owner:** {{user}}
**Created:** {{date}}
**Last Updated:** {{date}}
**Status:** Draft / In Review / Approved
**Version:** 1.0

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Stakeholder | | | |

---

## Executive Summary
[2-3 paragraphs describing what this product/feature is, why it's being built, and the expected business impact]

---

## Problem Statement

### Current Situation
[Describe the current state and pain points]

### User Pain Points
1. [Pain point description]
2. [Pain point description]
3. [Pain point description]

### Business Impact
[How these problems affect the business - metrics, revenue, customer satisfaction, etc.]

---

## Goals & Objectives

### Business Goals
1. [Measurable business goal]
2. [Measurable business goal]
3. [Measurable business goal]

### User Goals
1. [What users want to achieve]
2. [What users want to achieve]
3. [What users want to achieve]

### Success Metrics
| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| [Metric name] | [Value] | [Value] | [How to measure] |
| [Metric name] | [Value] | [Value] | [How to measure] |

---

## Target Users

### Primary Persona
**Name:** [Persona name]
**Role:** [Job title/role]
**Demographics:** [Age, location, etc.]
**Goals:** [What they want to achieve]
**Pain Points:** [Their challenges]
**Tech Savviness:** Low / Medium / High

### Secondary Persona
**Name:** [Persona name]
**Role:** [Job title/role]
**Demographics:** [Age, location, etc.]
**Goals:** [What they want to achieve]
**Pain Points:** [Their challenges]
**Tech Savviness:** Low / Medium / High

---

## User Stories

### Epic: [Epic Name]

**As a** [user type]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**Priority:** Must Have / Should Have / Nice to Have
**Effort Estimate:** [Story points or time]

---

## Functional Requirements

### Core Features

#### Feature 1: [Feature Name]
**Description:** [Detailed description]

**Requirements:**
1. The system shall [specific requirement]
2. The system shall [specific requirement]
3. The system shall [specific requirement]

**User Flow:**
1. User [action]
2. System [response]
3. User [action]
4. System [response]

**Edge Cases:**
- [Edge case scenario and expected behavior]
- [Edge case scenario and expected behavior]

#### Feature 2: [Feature Name]
**Description:** [Detailed description]

**Requirements:**
1. The system shall [specific requirement]
2. The system shall [specific requirement]

---

## Non-Functional Requirements

### Performance
- Page load time: < [X] seconds
- API response time: < [X] ms
- Concurrent users supported: [Number]

### Security
- [ ] [Security requirement]
- [ ] [Security requirement]
- [ ] [Security requirement]

### Accessibility
- [ ] WCAG 2.1 Level AA compliance
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility

### Scalability
- [Scalability requirement]
- [Scalability requirement]

---

## Design Requirements

### UI/UX Principles
- [Design principle]
- [Design principle]

### Mockups & Wireframes
[Link to Figma/design files]

### Design System
- Components: [List of UI components needed]
- Patterns: [Design patterns to follow]

---

## Technical Considerations

### Architecture
[High-level technical approach]

### Dependencies
- [External system or service]
- [External system or service]

### APIs & Integrations
| Integration | Purpose | Documentation |
|-------------|---------|---------------|
| [API name] | [What it does] | [Link] |

### Data Requirements
**Data to Collect:**
- [Data point]
- [Data point]

**Data Storage:**
- [Storage requirements]

---

## Out of Scope
[Explicitly list what is NOT included in this release]
- [Item]
- [Item]
- [Item]

---

## Launch Plan

### Phases
**Phase 1: MVP** (Target: [Date])
- [Feature]
- [Feature]

**Phase 2: Enhancement** (Target: [Date])
- [Feature]
- [Feature]

**Phase 3: Optimization** (Target: [Date])
- [Feature]
- [Feature]

### Rollout Strategy
- [ ] Internal beta testing
- [ ] Limited user beta (X% of users)
- [ ] Full rollout

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| [Risk] | High/Med/Low | High/Med/Low | [How to address] |
| [Risk] | High/Med/Low | High/Med/Low | [How to address] |

---

## Open Questions
- [ ] [Question that needs answering]
- [ ] [Question that needs answering]

---

## Appendix

### Research & Data
[Links to user research, surveys, analytics, etc.]

### Competitive Analysis
[How competitors solve this problem]

### References
- [Link or document]
- [Link or document]
`
  },
  {
    id: 'incident-report',
    name: 'Incident Report',
    description: 'Post-incident analysis and documentation',
    icon: AlertCircle,
    category: 'work',
    content: `# Incident Report

**Incident ID:** [INC-XXXX]
**Date of Incident:** {{date}}
**Time of Incident:** {{time}}
**Reported by:** {{user}}
**Severity:** Critical / High / Medium / Low
**Status:** Investigating / Resolved / Closed

---

## Executive Summary
[2-3 sentences describing what happened, the impact, and current status]

---

## Incident Details

### What Happened
[Detailed description of the incident]

### When It Happened
**Start Time:** [Date & Time]
**Detection Time:** [Date & Time]
**Resolution Time:** [Date & Time]
**Total Duration:** [Hours/Minutes]

### Where It Happened
**Affected Systems:**
- [System/Service name]
- [System/Service name]

**Affected Regions:**
- [Region/Location]

---

## Impact Assessment

### User Impact
**Users Affected:** [Number or percentage]
**Impact Type:** [Service unavailable / Degraded performance / Data loss / etc.]

**Customer-Facing Impact:**
- [Specific impact description]
- [Specific impact description]

### Business Impact
**Revenue Impact:** $[Amount] (estimated)
**SLA Breach:** Yes / No
**Reputation Impact:** [Description]

---

## Timeline of Events

| Time | Event | Action Taken | Person |
|------|-------|--------------|--------|
| [HH:MM] | [What happened] | [What was done] | [Name] |
| [HH:MM] | [What happened] | [What was done] | [Name] |
| [HH:MM] | [What happened] | [What was done] | [Name] |
| [HH:MM] | Incident resolved | [Final action] | [Name] |

---

## Root Cause Analysis

### Primary Cause
[Detailed explanation of the root cause]

### Contributing Factors
1. [Factor that contributed to the incident]
2. [Factor that contributed to the incident]
3. [Factor that contributed to the incident]

### Why It Wasn't Caught Earlier
[Explanation of why monitoring/testing didn't catch this]

---

## Resolution

### Immediate Fix
[What was done to resolve the incident]

### Verification
[How the fix was verified]

### Rollback Plan
[If applicable, what the rollback plan was]

---

## Action Items

### Immediate Actions (0-7 days)
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]

### Short-term Actions (1-4 weeks)
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]

### Long-term Actions (1-3 months)
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]

---

## Prevention Measures

### Technical Improvements
1. [Improvement to prevent recurrence]
2. [Improvement to prevent recurrence]

### Process Improvements
1. [Process change to prevent recurrence]
2. [Process change to prevent recurrence]

### Monitoring & Alerting
1. [New alert or monitoring to add]
2. [New alert or monitoring to add]

---

## Lessons Learned

### What Went Well
- [Positive aspect of the response]
- [Positive aspect of the response]

### What Could Be Improved
- [Area for improvement]
- [Area for improvement]

### Knowledge Gaps Identified
- [Gap in knowledge or documentation]
- [Gap in knowledge or documentation]

---

## Communication

### Internal Communication
**Stakeholders Notified:**
- [Name/Team] - [When] - [Method]

**Status Updates Sent:**
- [Time] - [Audience] - [Channel]

### External Communication
**Customer Communication:**
- [Time] - [Channel] - [Message summary]

**Status Page Updates:**
- [Time] - [Status posted]

---

## Supporting Information

### Logs & Evidence
[Links to relevant logs, screenshots, monitoring dashboards]

### Related Incidents
- [INC-XXXX] - [Brief description]

### Documentation Updated
- [ ] Runbook updated
- [ ] Architecture diagram updated
- [ ] Monitoring documentation updated

---

## Sign-off

**Reviewed by:**
- Engineering Lead: _________________ Date: _____
- Product Manager: _________________ Date: _____
- Operations Lead: _________________ Date: _____

**Incident Closed by:** _________________ Date: _____
`
  },
  {
    id: 'decision-log',
    name: 'Decision Log',
    description: 'Document important decisions and rationale',
    icon: CheckSquare,
    category: 'work',
    content: `# Decision Log

**Project/Initiative:** [Project name]
**Decision Owner:** {{user}}
**Date:** {{date}}

---

## Decision Summary
[One sentence describing the decision made]

---

## Decision Details

### Decision ID
**ID:** DEC-[YYYY-MM-DD]-[Number]
**Status:** Proposed / Approved / Implemented / Rejected
**Priority:** Critical / High / Medium / Low

### Context
[Background information and why this decision is needed]

### Problem Statement
[What problem are we trying to solve?]

---

## Options Considered

### Option 1: [Option Name]
**Description:**
[Detailed description of this option]

**Pros:**
- [Advantage]
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]
- [Disadvantage]

**Cost:** $[Amount] / [Time estimate]
**Risk Level:** High / Medium / Low

### Option 2: [Option Name]
**Description:**
[Detailed description of this option]

**Pros:**
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]

**Cost:** $[Amount] / [Time estimate]
**Risk Level:** High / Medium / Low

### Option 3: [Option Name]
**Description:**
[Detailed description of this option]

**Pros:**
- [Advantage]
- [Advantage]

**Cons:**
- [Disadvantage]
- [Disadvantage]

**Cost:** $[Amount] / [Time estimate]
**Risk Level:** High / Medium / Low

---

## Decision Made

### Selected Option
**Option:** [Option name]

### Rationale
[Detailed explanation of why this option was chosen]

**Key Factors:**
1. [Factor that influenced the decision]
2. [Factor that influenced the decision]
3. [Factor that influenced the decision]

### Trade-offs Accepted
- [Trade-off we're accepting]
- [Trade-off we're accepting]

---

## Impact Assessment

### Stakeholders Affected
| Stakeholder | Impact | Mitigation |
|-------------|--------|------------|
| [Team/Person] | [How they're affected] | [How to address] |
| [Team/Person] | [How they're affected] | [How to address] |

### Technical Impact
- [Technical implication]
- [Technical implication]

### Business Impact
- [Business implication]
- [Business implication]

### Timeline Impact
**Implementation Time:** [Duration]
**Go-live Date:** [Date]

---

## Implementation Plan

### Action Items
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]

### Dependencies
- [Dependency or prerequisite]
- [Dependency or prerequisite]

### Success Criteria
- [ ] [Measurable criterion]
- [ ] [Measurable criterion]
- [ ] [Measurable criterion]

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Strategy] |
| [Risk] | High/Med/Low | High/Med/Low | [Strategy] |

---

## Review & Approval

### Decision Makers
| Name | Role | Vote | Date |
|------|------|------|------|
| [Name] | [Title] | Approve/Reject | [Date] |
| [Name] | [Title] | Approve/Reject | [Date] |
| [Name] | [Title] | Approve/Reject | [Date] |

### Consulted
- [Name] - [Role] - [Input provided]
- [Name] - [Role] - [Input provided]

### Informed
- [Team/Person notified]
- [Team/Person notified]

---

## Follow-up

### Review Date
**Next Review:** [Date]
**Review Frequency:** [Weekly/Monthly/Quarterly]

### Metrics to Track
- [Metric to measure success]
- [Metric to measure success]

### Lessons Learned
[To be filled after implementation]

---

## References
- [Link to related document]
- [Link to research or data]
- [Link to previous decisions]

---

## Change Log
| Date | Change | Changed By |
|------|--------|------------|
| {{date}} | Initial decision | {{user}} |
| | | |
`
  }
];

const Templates = ({ onSelectTemplate, onClose, userName, hasExistingContent = false }) => {
  const [activeTab, setActiveTab] = useState('built-in');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', content: '' });

  useEffect(() => {
    // Load custom templates from localStorage
    const saved = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    setCustomTemplates(saved);
  }, []);

  const saveCustomTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      alert('Please fill in template name and content');
      return;
    }

    const template = {
      id: `custom-${Date.now()}`,
      ...newTemplate,
      createdAt: new Date().toISOString()
    };

    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    localStorage.setItem('customTemplates', JSON.stringify(updated));
    
    setNewTemplate({ name: '', description: '', content: '' });
    setShowCreateForm(false);
  };

  const deleteCustomTemplate = (id) => {
    if (!window.confirm('Delete this template?')) return;
    
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem('customTemplates', JSON.stringify(updated));
  };

  const applyTemplate = (template) => {
    let content = template.content;
    
    // Replace variables
    const now = new Date();
    content = content.replace(/\{\{date\}\}/g, now.toLocaleDateString());
    content = content.replace(/\{\{time\}\}/g, now.toLocaleTimeString());
    content = content.replace(/\{\{user\}\}/g, userName || 'User');
    content = content.replace(/\{\{title\}\}/g, template.name);
    
    // Convert markdown to blocks
    const blocks = parseMarkdownToBlocks(content);
    
    onSelectTemplate({
      title: template.name,
      content: content,
      blocks: blocks
    });
    onClose();
  };

  const parseMarkdownToBlocks = (markdown) => {
    const lines = markdown.split('\n');
    const blocks = [];
    let currentListItems = [];
    let currentListType = null;

    const flushList = () => {
      if (currentListItems.length > 0) {
        currentListItems.forEach(item => {
          blocks.push({
            id: Date.now() + Math.random(),
            type: currentListType === 'todo' ? 'todo' : currentListType === 'numbered' ? 'numberedList' : 'bulletList',
            content: cleanMarkdown(item.content),
            properties: currentListType === 'todo' ? { checked: item.checked } : {}
          });
        });
        currentListItems = [];
        currentListType = null;
      }
    };

    // Helper function to clean markdown formatting from text
    const cleanMarkdown = (text) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
        .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
        .replace(/__(.*?)__/g, '$1')      // Remove bold __text__
        .replace(/_(.*?)_/g, '$1')        // Remove italic _text_
        .replace(/`(.*?)`/g, '$1')        // Remove inline code `text`
        .trim();
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) {
        flushList();
        return;
      }

      // Heading 1
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading1',
          content: cleanMarkdown(trimmed.substring(2)),
          properties: {}
        });
      }
      // Heading 2
      else if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading2',
          content: cleanMarkdown(trimmed.substring(3)),
          properties: {}
        });
      }
      // Heading 3
      else if (trimmed.startsWith('### ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'heading3',
          content: cleanMarkdown(trimmed.substring(4)),
          properties: {}
        });
      }
      // Todo list
      else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        if (currentListType !== 'todo') {
          flushList();
          currentListType = 'todo';
        }
        currentListItems.push({
          content: trimmed.substring(5).trim(),
          checked: trimmed.includes('[x]')
        });
      }
      // Bullet list
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (currentListType !== 'bullet') {
          flushList();
          currentListType = 'bullet';
        }
        currentListItems.push({
          content: trimmed.substring(2).trim()
        });
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmed)) {
        if (currentListType !== 'numbered') {
          flushList();
          currentListType = 'numbered';
        }
        currentListItems.push({
          content: trimmed.replace(/^\d+\.\s/, '').trim()
        });
      }
      // Code block
      else if (trimmed.startsWith('```')) {
        flushList();
        // Skip code block markers for now
        return;
      }
      // Divider
      else if (trimmed === '---' || trimmed === '***') {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'divider',
          content: '',
          properties: {}
        });
      }
      // Quote
      else if (trimmed.startsWith('> ')) {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'quote',
          content: cleanMarkdown(trimmed.substring(2)),
          properties: {}
        });
      }
      // Regular paragraph (clean all markdown formatting)
      else {
        flushList();
        blocks.push({
          id: Date.now() + Math.random() + index,
          type: 'paragraph',
          content: cleanMarkdown(trimmed),
          properties: {}
        });
      }
    });

    // Flush any remaining list items
    flushList();

    // If no blocks were created, add a default paragraph
    if (blocks.length === 0) {
      blocks.push({
        id: Date.now(),
        type: 'paragraph',
        content: '',
        properties: {}
      });
    }

    return blocks;
  };

  const filteredBuiltIn = activeTab === 'built-in' 
    ? BUILT_IN_TEMPLATES 
    : BUILT_IN_TEMPLATES.filter(t => t.category === activeTab);

  return (
    <div className="tpl-modal">
        <div className="tpl-header">
          <h2>Note Templates</h2>
          <button className="tpl-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {hasExistingContent && (
          <div className="tpl-warning">
            <strong>⚠️ Warning:</strong> Applying a template will replace your current note content. 
            Consider creating a new note first to preserve your work.
          </div>
        )}

        <div className="tpl-tabs">
          <button
            className={`tpl-tab ${activeTab === 'built-in' ? 'active' : ''}`}
            onClick={() => setActiveTab('built-in')}
          >
            All Templates
          </button>
          <button
            className={`tpl-tab ${activeTab === 'work' ? 'active' : ''}`}
            onClick={() => setActiveTab('work')}
          >
            Work
          </button>
          <button
            className={`tpl-tab ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            Personal
          </button>
          <button
            className={`tpl-tab ${activeTab === 'education' ? 'active' : ''}`}
            onClick={() => setActiveTab('education')}
          >
            Education
          </button>
          <button
            className={`tpl-tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom ({customTemplates.length})
          </button>
        </div>

        <div className="tpl-content">
          {activeTab === 'custom' ? (
            <>
              {!showCreateForm && (
                <button
                  className="tpl-card tpl-card-dashed"
                  onClick={() => setShowCreateForm(true)}
                >
                  <div className="tpl-card-icon">
                    <FileText size={24} />
                  </div>
                  <h3>Create Custom Template</h3>
                  <p>Build your own reusable note template</p>
                </button>
              )}

              {showCreateForm && (
                <div className="tpl-form">
                  <h3>Create New Template</h3>
                  <div className="tpl-form-group">
                    <label>Template Name</label>
                    <input
                      type="text"
                      className="tpl-input"
                      placeholder="e.g., Bug Report, Recipe, etc."
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  <div className="tpl-form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      className="tpl-input"
                      placeholder="Brief description of this template"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    />
                  </div>
                  <div className="tpl-form-group">
                    <label>Template Content</label>
                    <textarea
                      className="tpl-textarea"
                      placeholder="Enter your template content here..."
                      value={newTemplate.content}
                      onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    />
                    <div className="tpl-hint">
                      <strong>Available Variables:</strong>
                      <div>
                        <code>{'{{date}}'}</code> - Current date
                        <br />
                        <code>{'{{time}}'}</code> - Current time
                        <br />
                        <code>{'{{user}}'}</code> - Your username
                        <br />
                        <code>{'{{title}}'}</code> - Template name
                      </div>
                    </div>
                  </div>
                  <div className="tpl-form-actions">
                    <button
                      className="tpl-btn tpl-btn-secondary"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTemplate({ name: '', description: '', content: '' });
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="tpl-btn tpl-btn-primary"
                      onClick={saveCustomTemplate}
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              )}

              {customTemplates.length > 0 && (
                <div className="tpl-saved-list">
                  {customTemplates.map(template => (
                    <div key={template.id} className="tpl-saved-item">
                      <div
                        className="tpl-saved-info"
                        onClick={() => applyTemplate(template)}
                      >
                        <h4>{template.name}</h4>
                        <p>{template.description || 'No description'}</p>
                      </div>
                      <div className="tpl-saved-actions">
                        <button
                          className="tpl-action-btn"
                          onClick={() => applyTemplate(template)}
                        >
                          Use
                        </button>
                        <button
                          className="tpl-action-btn delete"
                          onClick={() => deleteCustomTemplate(template.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="tpl-grid">
              {filteredBuiltIn.map(template => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.id}
                    className="tpl-card"
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="tpl-card-icon">
                      <Icon size={24} />
                    </div>
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
};

export default Templates;
