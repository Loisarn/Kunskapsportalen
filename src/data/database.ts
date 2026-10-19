import Dexie, { type EntityTable, type Transaction } from 'dexie'
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

export type SyncTableName = 'profiles' | 'progress' | 'learningPathProgress' | 'sessions' | 'achievements' | 'challengeProgress'
export type SyncOperation = 'upsert' | 'delete'

export interface SyncOutboxEntry {
  id: string
  tableName: SyncTableName
  recordId: string
  operation: SyncOperation
  changedAt: string
}

export interface SyncState {
  id: string
  userId: string
  lastSyncedAt?: string
  lastError?: string
}

let syncSuppression = 0

async function withSyncSuppressed<T>(operation: () => Promise<T>): Promise<T> {
  syncSuppression += 1
  try {
    return await operation()
  } finally {
    syncSuppression -= 1
  }
}

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
  syncOutbox!: EntityTable<SyncOutboxEntry, 'id'>
  syncState!: EntityTable<SyncState, 'id'>

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
    this.version(5).stores({
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
      syncOutbox: 'id, tableName, recordId, changedAt',
      syncState: 'id, userId',
    })

    const track = <T extends { id: string; updatedAt?: string }>(table: EntityTable<T, 'id'>, tableName: SyncTableName) => {
      const queue = (recordId: string, operation: SyncOperation, transaction: Transaction, changedAt = new Date().toISOString()) => {
        transaction.on('complete', () => {
          void database.syncOutbox.put({ id: `${tableName}:${recordId}`, tableName, recordId, operation, changedAt })
            .then(() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('knowledge-portal:sync-needed')) })
            .catch(() => undefined)
        })
      }
      table.hook('creating', (primaryKey, record, transaction) => {
        if (syncSuppression) return
        const changedAt = new Date().toISOString()
        record.updatedAt = changedAt
        queue(String(primaryKey ?? record.id), 'upsert', transaction, changedAt)
      })
      table.hook('updating', (_changes, primaryKey, _record, transaction) => {
        if (syncSuppression) return
        const updatedAt = new Date().toISOString()
        queue(String(primaryKey), 'upsert', transaction, updatedAt)
        return { updatedAt }
      })
      table.hook('deleting', (primaryKey, _record, transaction) => {
        if (!syncSuppression) queue(String(primaryKey), 'delete', transaction)
      })
    }

    track(this.profiles, 'profiles')
    track(this.progress, 'progress')
    track(this.learningPathProgress, 'learningPathProgress')
    track(this.sessions, 'sessions')
    track(this.achievements, 'achievements')
    track(this.challengeProgress, 'challengeProgress')
  }
}

export const database = new KnowledgeDatabase()
export { withSyncSuppressed }