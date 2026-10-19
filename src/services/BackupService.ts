import { database } from '../data/database'
import type {
  Achievement,
  ChildChallengeProgress,
  ChildLearningPathProgress,
  ChildProfile,
  ConceptProgress,
  ParentSettings,
  PlaySession,
} from '../domain/types'

const backupFormat = 'kunskapsportalen-backup'
const selectedProfileKey = 'knowledge-portal.selected-profile'

interface BackupData {
  profiles: ChildProfile[]
  progress: ConceptProgress[]
  learningPathProgress: ChildLearningPathProgress[]
  sessions: PlaySession[]
  achievements: Achievement[]
  challengeProgress: ChildChallengeProgress[]
  settings: ParentSettings[]
}

interface BackupDocument {
  format: typeof backupFormat
  version: 1
  createdAt: string
  selectedProfileId: string | null
  data: BackupData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStrings(record: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof record[field] === 'string')
}

function hasNumbers(record: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof record[field] === 'number' && Number.isFinite(record[field]))
}

function readRows<T>(
  data: Record<string, unknown>,
  table: keyof BackupData,
  isValid: (record: Record<string, unknown>) => boolean,
): T[] {
  const rows = data[table]
  if (!Array.isArray(rows)) throw new Error(`Säkerhetskopian saknar tabellen ${table}.`)
  const ids = new Set<string>()
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || !isValid(row)) {
      throw new Error(`Säkerhetskopian innehåller ogiltiga data i ${table}.`)
    }
    if (ids.has(row.id)) throw new Error(`Säkerhetskopian innehåller dubbla ID:n i ${table}.`)
    ids.add(row.id)
  }
  return rows as T[]
}

function parseBackup(contents: string): BackupDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('Filen är inte en giltig säkerhetskopia.')
  }
  if (!isRecord(parsed) || parsed.format !== backupFormat || parsed.version !== 1 || !isRecord(parsed.data)) {
    throw new Error('Filen känns inte igen som en säkerhetskopia från Kunskapsportalen.')
  }

  const data = parsed.data
  const profiles = readRows<ChildProfile>(data, 'profiles', (row) =>
    hasStrings(row, ['name', 'avatar']) && hasNumbers(row, ['xp', 'level', 'streakDays']))
  const progress = readRows<ConceptProgress>(data, 'progress', (row) =>
    hasStrings(row, ['profileId', 'conceptId'])
      && typeof row.introduced === 'boolean'
      && hasNumbers(row, ['mastery', 'correctAnswers', 'wrongAnswers'])
      && Array.isArray(row.seenDiscoveries))
  const learningPathProgress = readRows<ChildLearningPathProgress>(data, 'learningPathProgress', (row) =>
    hasStrings(row, ['profileId', 'learningPathId', 'placementMethod'])
      && hasNumbers(row, ['startingLevel', 'currentLevel']))
  const sessions = readRows<PlaySession>(data, 'sessions', (row) =>
    hasStrings(row, ['profileId', 'conceptId', 'startedAt'])
      && hasNumbers(row, ['totalQuestions', 'xpEarned'])
      && Array.isArray(row.answers))
  const achievements = readRows<Achievement>(data, 'achievements', (row) =>
    hasStrings(row, ['profileId', 'title', 'description', 'emoji', 'earnedAt']))
  const challengeProgress = readRows<ChildChallengeProgress>(data, 'challengeProgress', (row) =>
    hasStrings(row, ['profileId', 'challengeId', 'weekKey']) && hasNumbers(row, ['progress']))
  const settings = readRows<ParentSettings>(data, 'settings', (row) => row.id === 'parent' && hasStrings(row, ['pin']))

  const profileIds = new Set(profiles.map(({ id }) => id))
  const relatedRows = [...progress, ...learningPathProgress, ...sessions, ...achievements, ...challengeProgress]
  if (relatedRows.some(({ profileId }) => !profileIds.has(profileId))) {
    throw new Error('Säkerhetskopian innehåller framsteg utan en tillhörande profil.')
  }
  const selectedProfileId = parsed.selectedProfileId
  if (selectedProfileId !== null && typeof selectedProfileId !== 'string') {
    throw new Error('Säkerhetskopian har ett ogiltigt aktivt profil-ID.')
  }

  return {
    format: backupFormat,
    version: 1,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    selectedProfileId: typeof selectedProfileId === 'string' && profileIds.has(selectedProfileId) ? selectedProfileId : null,
    data: { profiles, progress, learningPathProgress, sessions, achievements, challengeProgress, settings },
  }
}

export const BackupService = {
  async exportData(): Promise<string> {
    const [profiles, progress, learningPathProgress, sessions, achievements, challengeProgress, settings] = await Promise.all([
      database.profiles.toArray(),
      database.progress.toArray(),
      database.learningPathProgress.toArray(),
      database.sessions.toArray(),
      database.achievements.toArray(),
      database.challengeProgress.toArray(),
      database.settings.toArray(),
    ])
    const backup: BackupDocument = {
      format: backupFormat,
      version: 1,
      createdAt: new Date().toISOString(),
      selectedProfileId: localStorage.getItem(selectedProfileKey),
      data: { profiles, progress, learningPathProgress, sessions, achievements, challengeProgress, settings },
    }
    return JSON.stringify(backup, null, 2)
  },

  async restoreData(contents: string): Promise<void> {
    const { data, selectedProfileId } = parseBackup(contents)
    await database.transaction(
      'rw',
      [
        database.profiles,
        database.progress,
        database.learningPathProgress,
        database.sessions,
        database.achievements,
        database.challengeProgress,
        database.settings,
      ],
      async () => {
        await database.profiles.clear()
        await database.progress.clear()
        await database.learningPathProgress.clear()
        await database.sessions.clear()
        await database.achievements.clear()
        await database.challengeProgress.clear()
        await database.settings.clear()
        await database.profiles.bulkPut(data.profiles)
        await database.progress.bulkPut(data.progress)
        await database.learningPathProgress.bulkPut(data.learningPathProgress)
        await database.sessions.bulkPut(data.sessions)
        await database.achievements.bulkPut(data.achievements)
        await database.challengeProgress.bulkPut(data.challengeProgress)
        await database.settings.bulkPut(data.settings)
      },
    )
    if (selectedProfileId) localStorage.setItem(selectedProfileKey, selectedProfileId)
    else localStorage.removeItem(selectedProfileKey)
  },
}
