export type NoteTemplateCategory = 'work' | 'custom';

export type NoteTemplate = {
  id: string;
  name: string;
  description: string;
  category: NoteTemplateCategory;
  content: string;
};

export const BUILT_IN_NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Professional meeting documentation with action items',
    category: 'work',
    content: `# Meeting Notes

Date: {{date}}
Time: {{time}}
Facilitator: {{user}}
Location: [Conference Room / Virtual]

## Objective
[What should this meeting accomplish?]

## Agenda
1. [Topic]
2. [Topic]
3. [Topic]

## Discussion Notes
- Key point
- Decision
- Follow-up

## Action Items
- [Task] — Owner: [Name] — Due: [Date]
- [Task] — Owner: [Name] — Due: [Date]

## Risks / Blockers
- [Risk]

## Next Steps
- [Next step]
`,
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Comprehensive project planning and requirements document',
    category: 'work',
    content: `# Project Brief: {{title}}

Owner: {{user}}
Created: {{date}}
Status: Planning / In Progress / Blocked / Complete

## Executive Summary
[2-3 sentence overview]

## Problem
[What problem are we solving?]

## Goals
1. [Goal]
2. [Goal]
3. [Goal]

## Scope
### In Scope
- [Item]
- [Item]

### Out of Scope
- [Item]
- [Item]

## Timeline
- Milestone 1: [Date]
- Milestone 2: [Date]
- Launch: [Date]

## Risks
- [Risk] — Mitigation: [Plan]

## Notes
[Additional details]
`,
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Agile sprint planning and tracking template',
    category: 'work',
    content: `# Sprint Planning

Sprint: [Number]
Dates: [Start] → [End]
Scrum Master: {{user}}
Sprint Goal: [One-sentence goal]

## Capacity
- Team capacity: [Points / Hours]
- Planned velocity: [Value]
- Constraints: [Vacations / Dependencies]

## High Priority
- [Story / task]
- [Story / task]

## Medium Priority
- [Story / task]
- [Story / task]

## Technical Debt / Bugs
- [Bug / refactor]

## Definition of Done
- Code reviewed
- Tests passing
- Documentation updated
- Product approved

## Risks
- [Risk] — [Mitigation]
`,
  },
  {
    id: 'weekly-status',
    name: 'Weekly Status Report',
    description: 'A concise weekly progress update for teams and stakeholders',
    category: 'work',
    content: `# Weekly Status Report

Week of: {{date}}
Prepared by: {{user}}

## Highlights
- [Major win]
- [Major win]

## Completed This Week
- [Task]
- [Task]

## In Progress
- [Task]
- [Task]

## Blockers
- [Blocker]

## Metrics
- Progress: [%]
- Risks opened: [#]
- Decisions made: [#]

## Next Week
- [Priority]
- [Priority]
`,
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting Template',
    description: 'Track feedback, priorities, and follow-ups in recurring check-ins',
    category: 'work',
    content: `# 1:1 Meeting

Manager / Peer: [Name]
Prepared by: {{user}}
Date: {{date}}

## Wins Since Last Meeting
- [Win]
- [Win]

## Current Focus
- [Priority]
- [Priority]

## Challenges
- [Challenge]

## Feedback
- [Feedback]

## Career / Growth
- [Topic]

## Support Needed
- [Ask]

## Action Items
- [Owner] — [Task]
`,
  },
  {
    id: 'product-requirements',
    name: 'Product Requirements (PRD)',
    description: 'A structured product requirements doc for feature delivery',
    category: 'work',
    content: `# Product Requirements Document

Feature: {{title}}
Author: {{user}}
Date: {{date}}

## Summary
[Brief overview]

## User Problem
[What pain point exists?]

## Success Metrics
- [Metric]
- [Metric]

## User Stories
1. As a [user], I want [capability] so that [benefit].
2. As a [user], I want [capability] so that [benefit].

## Requirements
- Functional:
  - [Requirement]
  - [Requirement]
- Non-functional:
  - [Requirement]

## Edge Cases
- [Case]
- [Case]

## Launch Plan
- QA
- Rollout
- Monitoring
`,
  },
  {
    id: 'incident-report',
    name: 'Incident Report',
    description: 'Document outages, impact, root cause, and remediation',
    category: 'work',
    content: `# Incident Report

Incident Title: {{title}}
Reported by: {{user}}
Date: {{date}}
Severity: Sev 1 / Sev 2 / Sev 3

## Summary
[What happened?]

## Impact
- Users affected:
- Systems affected:
- Duration:

## Timeline
- [Time] — [Event]
- [Time] — [Event]

## Root Cause
[Underlying cause]

## Mitigation
- [Action]

## Follow-up Actions
- [Owner] — [Task]
- [Owner] — [Task]
`,
  },
  {
    id: 'decision-log',
    name: 'Decision Log',
    description: 'Record important decisions, rationale, and consequences',
    category: 'work',
    content: `# Decision Log

Decision: {{title}}
Date: {{date}}
Owner: {{user}}
Status: Proposed / Approved / Rejected

## Context
[Background]

## Options Considered
1. [Option]
2. [Option]
3. [Option]

## Decision
[Chosen option]

## Rationale
- [Reason]
- [Reason]

## Trade-offs
- [Trade-off]

## Follow-up
- [Action]
`,
  },
];

export function applyTemplateVariables(template: NoteTemplate, userName: string) {
  const now = new Date();
  return template.content
    .replace(/\{\{date\}\}/g, now.toLocaleDateString())
    .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
    .replace(/\{\{user\}\}/g, userName || 'User')
    .replace(/\{\{title\}\}/g, template.name);
}
