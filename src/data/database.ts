import Dexie, { type EntityTable } from 'dexie'
import type {
  Achievement,
  ChildProfile,
  ChildLearningPathProgress,
  ChildChallengeProgress,
  Challenge,
  ConceptProgress,
  ContentPackage,
  LearningPath,
  ParentSettings,
  PlaySession,
} from '../domain/types'

class KnowledgeDatabase extends Dexie {
  profiles!: EntityTable<ChildProfile, 'id'>
  progress!: EntityTable<ConceptProgress, 'id'>
  learningPathProgress!: EntityTable<ChildLearningPathProgress, 'id'>
  challenges!: EntityTable<Challenge, 'id'>
  challengeProgress!: EntityTable<ChildChallengeProgress, 'id'>
  sessions!: EntityTable<PlaySession, 'id'>
  achievements!: EntityTable<Achievement, 'id'>
  contentPackages!: EntityTable<ContentPackage, 'id'>
  learningPaths!: EntityTable<LearningPath, 'id'>
  settings!: EntityTable<ParentSettings, 'id'>

  constructor() {
    super('knowledge-portal')
    this.version(1).stores({
      profiles: 'id, name',
      progress: 'id, profileId, conceptId, [profileId+conceptId]',
      sessions: 'id, profileId, conceptId, startedAt, completedAt',
      achievements: 'id, profileId, earnedAt',
      contentPackages: 'id, concept.id',
      settings: 'id',
    })
    this.version(2).stores({
      profiles: 'id, name',
      progress: 'id, profileId, conceptId, [profileId+conceptId]',
      sessions: 'id, profileId, conceptId, startedAt, completedAt',
      achievements: 'id, profileId, earnedAt',
      contentPackages: 'id, concept.id, learningPath.id',
      learningPaths: 'id, subjectId',
      settings: 'id',
    })
    this.version(3).stores({
      profiles: 'id, name',
      progress: 'id, profileId, conceptId, [profileId+conceptId]',
      learningPathProgress: 'id, profileId, learningPathId, [profileId+learningPathId]',
      sessions: 'id, profileId, conceptId, startedAt, completedAt',
      achievements: 'id, profileId, earnedAt',
      contentPackages: 'id, concept.id, learningPath.id',
      learningPaths: 'id, subjectId',
      settings: 'id',
    })
    this.version(4).stores({
      profiles: 'id, name',
      progress: 'id, profileId, conceptId, [profileId+conceptId]',
      learningPathProgress: 'id, profileId, learningPathId, [profileId+learningPathId]',
      sessions: 'id, profileId, conceptId, startedAt, completedAt, [profileId+dailyDate]',
      achievements: 'id, profileId, earnedAt',
      contentPackages: 'id, concept.id, learningPath.id',
      learningPaths: 'id, subjectId',
      challenges: 'id, type, pathId',
      challengeProgress: 'id, profileId, challengeId, weekKey, [profileId+weekKey]',
      settings: 'id',
    })
  }
}

export const database = new KnowledgeDatabase()