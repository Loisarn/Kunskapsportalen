# Domain Model

## Core Principle

Concept is the central entity of the system.

Everything revolves around Concepts.

---

# Child

Represents a child profile.

## Properties

- id
- name
- avatar
- xp
- level (reward progression only)
- streakDays
- optional stars
- optional lastActiveDate
- optional readingStartLevel, collected during new-profile setup

Completing a Daily Adventure grants one star and 100 XP. Streaks advance at most once per local calendar day when a session is completed.

A device may store any number of child profiles. Each child has independent Concept and Learning Path progress.

New profiles choose one starting method:

- beginning: start at the first available Concept in every Learning Path
- placement: estimate a starting Concept from questions in the available content
- manual: let the parent or child select an available level in each Learning Path

New profiles choose a reading start level: letter recognition, simple 3-4 letter words, longer words and short sentences, or direct entry to Reading Comprehension. Existing profiles are not rerouted automatically.

Placement estimates are limited to the levels and questions present in content packages. General Knowledge may include multiple Learning Paths, such as Animals and Space.

---

# Subject

High-level educational category.

## Examples

- Math
- English
- Swedish
- Albanian
- General Knowledge

---

# LearningPath

A progression of Concepts within a Subject.

## Properties

- id
- subjectId
- title
- description
- discoveryMasteryBonus

Parents introduce recommended Concepts. The system never introduces a Concept automatically.

Progression is tracked independently for each child and Learning Path. A child's current level advances when a parent introduces a higher-level Concept; XP and the profile reward level do not determine learning placement.

---

# Concept

The fundamental educational unit.

## Examples

- Addition 1-10
- English Animals
- Planets

## Relationships

A Concept can contain:

- one Lesson
- many KnowledgeCards
- many Questions
- many Discoveries

---

# KnowledgeCard

Stores structured knowledge associated with one Concept.

## Properties

- id
- conceptId
- title
- description
- optional emoji
- facts, as string key-value pairs
- optional Discovery IDs

---

# Lesson

Introduces a new concept.

Displayed in Parent Mode.

---

# Discovery

Interesting fact cards shown in Discover mode.

Used to encourage curiosity.

---

# Question

Assessment item linked to a Concept.

Supported types:

- Multiple Choice
- True/False
- Text

---

# ChildConceptProgress

Tracks learning progress for a Concept.

## Properties

- introduced
- optional parentCompleted
- mastery
- correctAnswers
- wrongAnswers
- completedDiscoveries
- completedDiscoveryDates
- lastPracticedAt
- nextReviewAt

Parents may introduce any Concept, regardless of its recommendation status. They may also mark a Concept complete for one child without changing its answers, mastery, or introduction status; parent-completed Concepts satisfy prerequisites for later Concepts. Parents may withdraw an introduction without deleting historical answers, mastery, or completed Discoveries; the affected Learning Path's current selection is recalculated.

---

# ChildLearningPathProgress

Stores one child's starting and current level for a Learning Path.

## Properties

- profileId
- learningPathId
- startingLevel
- currentLevel
- selectedConceptId
- placementMethod (beginning, placement, or manual)
- updatedAt

Existing profiles are initialized from their already introduced Concepts. This migration does not delete profile, XP, achievement, or Concept progress data.

---

# Session

Represents one play session.

Contains:

- multiple questions
- answers
- earned XP
- optional dailyDate, limiting each child to one Daily Adventure per local calendar day
- optional question keys and a question snapshot so an in-progress Daily Adventure can resume if package content changes

Daily Adventures select 20 unique questions from the child's introduced Concepts. Completing one grants the daily reward and updates the child's streak. Existing non-daily sessions remain supported.

---

# SessionAnswer

Stores a single answer given during a session.

---

# Achievement

Represents rewards and milestones.

Examples:

- First Question
- Math Hero
- 3, 7, and 30 Day Streaks

---

# Challenge

A weekly, content-aware goal such as discovering facts from a Learning Path or answering reading questions.

## ChildChallengeProgress

Progress is scoped to one child and one week. Completing a challenge grants its XP once and may award a badge achievement.

---

# Parent Reporting

Parent Mode summarizes each child's Learning Path and Concept progress, completed Discoveries, weekly challenge progress, and earned achievements. Viewing reports does not alter progress.

---

# ParentSettings

Application-level settings.

Examples:

- parent PIN
- session length
- mastery threshold