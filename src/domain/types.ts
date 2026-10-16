export type QuestionType = 'multiple-choice' | 'true-false' | 'text'

export interface Subject {
  id: string
  name: string
}

export interface LearningPath {
  id: string
  subjectId: string
  title: string
  description: string
  discoveryMasteryBonus: number
}

export interface Concept {
  id: string
  subjectId: string
  pathId: string
  level: number
  title: string
  description: string
  emoji: string
  difficulty: number
  requiredMastery: number
  prerequisites: string[]
}

export interface Lesson {
  id: string
  title: string
  content: string
}

export interface Discovery {
  id: string
  conceptId: string
  title: string
  body: string
  emoji: string
}

export interface KnowledgeCard {
  id: string
  conceptId: string
  title: string
  description: string
  emoji?: string
  facts: Record<string, string>
  discoveries?: string[]
}

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  answer: string
  options?: string[]
}

export interface ContentPackage {
  id: string
  subject: Subject
  learningPath: LearningPath
  concept: Concept
  lesson: Lesson
  knowledgeCards?: KnowledgeCard[]
  discoveries: Discovery[]
  questions: Question[]
}

export interface ChildProfile {
  id: string
  name: string
  avatar: string
  xp: number
  level: number
  streakDays: number
  stars?: number
  lastActiveDate?: string
  readingStartLevel?: number
}

export type PlacementMethod = 'beginning' | 'placement' | 'manual'

export interface ChildLearningPathProgress {
  id: string
  profileId: string
  learningPathId: string
  startingLevel: number
  currentLevel: number
  selectedConceptId?: string
  placementMethod: PlacementMethod
  updatedAt: string
}

export interface ConceptProgress {
  id: string
  profileId: string
  conceptId: string
  introduced: boolean
  parentCompleted?: boolean
  mastery: number
  correctAnswers: number
  wrongAnswers: number
  seenDiscoveries: string[]
  completedDiscoveries?: string[]
  completedDiscoveryDates?: Record<string, string>
  lastPracticedAt?: string
}

export interface SessionAnswer {
  conceptId?: string
  questionId: string
  value: string
  correct: boolean
}

export interface PlaySession {
  id: string
  profileId: string
  conceptId: string
  conceptIds?: string[]
  startedAt: string
  completedAt?: string
  dailyDate?: string
  questionKeys?: string[]
  questionSnapshot?: Array<Question & { conceptId: string }>
  totalQuestions: number
  answers: SessionAnswer[]
  xpEarned: number
}

export interface Achievement {
  id: string
  profileId: string
  title: string
  description: string
  emoji: string
  earnedAt: string
}

export interface Challenge {
  id: string
  title: string
  description: string
  type: string
  target: number
  rewardXp: number
  rewardBadge?: string
  pathId?: string
}

export interface ChildChallengeProgress {
  id: string
  profileId: string
  challengeId: string
  weekKey: string
  progress: number
  completedAt?: string
}

export interface ParentSettings {
  id: 'parent'
  pin: string
}

export interface AnswerFeedback {
  correct: boolean
  correctAnswer: string
  xpEarned: number
}

export interface ProgressSummary {
  profile: ChildProfile
  sessionsCompleted: number
  questionsAnswered: number
  correctAnswers: number
  achievements: Achievement[]
  conceptProgress: Array<{ concept: Concept; progress: ConceptProgress; subject: Subject }>
}