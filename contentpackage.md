# Content Package Specification v4.0

## Purpose

Content Packages are the primary way educational content enters the system.

The application should never require code changes to add new learning content.

Educational progression is driven by Learning Paths, Levels and Mastery.

---

# Core Principles

## One Concept Per Package

Each package represents exactly one Concept.

Examples:

- Addition 1-10
- Addition 1-20
- Multiplication Basics
- English Animals
- Planets

---

## Progression-Based Learning

Concepts belong to Learning Paths.

Children progress through Concepts within each Learning Path. Progress is stored separately for every child and Learning Path rather than represented by one global level.

New profiles may start from the beginning, use a placement assessment, or select a manual starting level. Placement can only estimate levels represented by available packages and multiple-choice questions. The selected Concept is introduced for that child; later Concepts remain parent-controlled.

XP and the profile's global level remain reward mechanics and are not used to determine learning placement.

---

## Parent-Controlled Introduction

The system may recommend concepts.

Parents decide when concepts become available.

Concepts are never automatically introduced.

---

# Structure

json
{
  "subject": {},
  "learningPath": {},
  "concept": {},
  "lesson": {},
  "knowledgeCards": [],
  "discoveries": [],
  "questions": []
}

`knowledgeCards` is optional. Packages created before version 4 remain valid and are loaded with no KnowledgeCards.


---

# Subject

Represents a high-level subject.

Example:

json
{
  "id": "math",
  "name": "Mathematics"
}


---

# Learning Path

Represents a progression path within a subject.

Example:

json
{
  "id": "mathematics",
  "subjectId": "math",
  "title": "Mathematics",
  "description": "Progressive mathematics learning path.",
  "discoveryMasteryBonus": 5
}


---

# Concept

The core educational unit.

json
{
  "id": "addition_1_10",
  "subjectId": "math",
  "pathId": "mathematics",

  "level": 1,

  "title": "Addition 1-10",

  "description": "Basic addition within ten.",

  "difficulty": 1,

  "requiredMastery": 90,

  "prerequisites": []
}


---

# Level

Represents the concept's position inside the Learning Path.

Examples:

Level 1
Addition 1-10


Level 2
Addition 1-20


Level 3
Addition 1-100

Level numbers must be unique within a Learning Path.

---

# Prerequisites

A Concept may require other Concepts.

Example:

json
[
  "addition_1_10"
]


Meaning:

Addition 1-10 should normally be mastered first.


---

# Required Mastery

Determines when the system should recommend the next Concept.

Example:

json
90


Meaning:

90% mastery required.


---

# Lesson

Used in Parent Mode.

Introduces a new Concept.

Example:

json
{
  "title": "What does plus mean?",
  "content": "Addition is used when combining quantities.",
  "examples": [
    "1 + 1 = 2",
    "2 + 3 = 5"
  ]
}


---

# Knowledge Cards

KnowledgeCards store structured facts for a Concept. They are optional and displayed in Explore mode.

json
{
  "id": "earth",
  "conceptId": "planets",
  "title": "Earth",
  "description": "Our home planet.",
  "emoji": "🌍",
  "facts": {
    "Position": "Third planet from the Sun.",
    "Natural satellites": "One Moon."
  },
  "discoveries": ["earth-discovery-1"]
}

Each card must belong to its package Concept. Fact values are strings, and referenced Discovery IDs must belong to the same Concept.


---

# Discoveries

Used in Explore mode.

Recommended:

3-10 discoveries

Example:

json
{
  "id": "discovery_1",
  "conceptId": "addition_1_10",
  "title": "Did you know?",
  "body": "Mathematics is used every day when shopping."
}

Every Discovery belongs to exactly one Concept. Completing its content is saved to that child's Concept progress.


---

# Questions

Supported question types:

## Multiple Choice

json
{
  "type": "multiple-choice"
}


## True / False

json
{
  "type": "true-false"
}


## Text

json
{
  "type": "text"
}


---

# Recommended Package Size

Minimum:

1 lesson
1 discovery
10 questions


Recommended:

1 lesson
3-10 discoveries
30-100 questions


---

# Example

json
{
  "subject": {
    "id": "math",
    "name": "Mathematics"
  },

  "learningPath": {
    "id": "mathematics",
    "subjectId": "math",
    "title": "Mathematics"
  },

  "concept": {
    "id": "addition_1_10",
    "subjectId": "math",
    "pathId": "mathematics",

    "level": 1,

    "title": "Addition 1-10",

    "difficulty": 1,

    "requiredMastery": 90,

    "prerequisites": []
  },

  "lesson": {},

  "discoveries": [],

  "questions": []
}

---

# Session Generation

Questions from all introduced Concepts should be eligible for selection.

The application must:

1. Load all introduced Concepts.
2. Build a combined question pool.
3. Weight selection by mastery.
4. Prefer Concepts with lower mastery.
5. Avoid duplicate questions in the same session.
6. Track the owning Concept for every selected Question so answers update that Concept's progress.

---

# Recommendation Rules

The platform may recommend a Concept when it has not been introduced and all its prerequisites are ready.

Prerequisite readiness is Question mastery plus `discoveryMasteryBonus` points per completed Discovery, capped at 100. The default bonus is 5 points per Discovery.

Each prerequisite is ready when its readiness meets that prerequisite Concept's `requiredMastery`.

If a Concept has no explicit prerequisites and its level is above 1, the previous level in that Learning Path is used as its prerequisite. A level 1 Concept with no prerequisites is a starting recommendation.

Recommendations appear in Parent Mode but never automatically introduce Concepts. Parents must introduce every recommended Concept.

---

# AI Generation Rules

AI may be used to generate:

- Lessons
- Discoveries
- Questions

AI must not be used during gameplay.

All generated content must be saved in Content Packages.

---

# Validation Rules

Required:

- subject
- learningPath
- concept
- lesson
- questions

Minimum:

- 1 question

Validation should fail if:

- learning path is missing or invalid
- level is missing
- pathId is missing
- requiredMastery is missing
- concept id is missing
- a Concept references a different subject or path than its package
- a Discovery references a different Concept than its package
- duplicate Concept IDs or duplicate levels within a Learning Path
- a prerequisite references a Concept that is not included in the package collection
- a KnowledgeCard references a different Concept or a missing Discovery
- prerequisite IDs are invalid or include the Concept itself
- level is not a positive integer or requiredMastery is outside 0-100