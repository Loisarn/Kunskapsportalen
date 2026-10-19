import type { EntityTable } from 'dexie'
import type { Session } from '@supabase/supabase-js'
import { database, withSyncSuppressed, type SyncOutboxEntry, type SyncTableName } from '../data/database'
import { SupabaseProgressRepository, type SupabaseProgressRow, type SupabaseTombstone } from '../data/SupabaseProgressRepository'
import { supabaseClient, supabaseConfigured } from '../data/supabaseClient'
import type { ConceptProgress, PlaySession } from '../domain/types'

interface SyncRecord {
  id: string
  profileId?: string
  updatedAt?: string
  [key: string]: unknown
}

interface SyncResult {
  configured: boolean
  authenticated: boolean
  syncedAt?: string
  pendingCount: number
  error?: string
}

const entities: Array<{ local: SyncTableName; remote: string }> = [
  { local: 'profiles', remote: 'child_profiles' },
  { local: 'progress', remote: 'child_concept_progress' },
  { local: 'learningPathProgress', remote: 'child_learning_path_progress' },
  { local: 'sessions', remote: 'play_sessions' },
  { local: 'achievements', remote: 'achievements' },
  { local: 'challengeProgress', remote: 'challenge_progress' },
]

function localTable(name: SyncTableName): EntityTable<SyncRecord, 'id'> {
  return database[name] as unknown as EntityTable<SyncRecord, 'id'>
}

function childIdFor(name: SyncTableName, record: SyncRecord): string {
  return name === 'profiles' ? record.id : record.profileId ?? ''
}

function timestamp(value?: string): number {
  const parsed = value ? Date.parse(value) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function rowPayload(value: unknown): SyncRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Partial<SyncRecord>
  return typeof record.id === 'string' ? record as SyncRecord : undefined
}

function mergeRecord(local: SyncRecord, remote: SyncRecord, tableName: SyncTableName, remoteUpdatedAt: string): SyncRecord {
  const localIsNewer = timestamp(local.updatedAt) > timestamp(remoteUpdatedAt)
  const base = localIsNewer ? local : remote
  const updatedAt = localIsNewer ? local.updatedAt : remoteUpdatedAt
  if (tableName === 'profiles') {
    const latestActivity = String(local.lastActiveDate ?? '') > String(remote.lastActiveDate ?? '') ? local : remote
    return {
      ...base,
      xp: Math.max(Number(local.xp ?? 0), Number(remote.xp ?? 0)),
      level: Math.max(Number(local.level ?? 1), Number(remote.level ?? 1)),
      stars: Math.max(Number(local.stars ?? 0), Number(remote.stars ?? 0)),
      streakDays: Number(latestActivity.streakDays ?? 0),
      lastActiveDate: latestActivity.lastActiveDate,
      updatedAt,
    }
  }
  if (tableName === 'progress') {
    const mergedDates = { ...(remote.completedDiscoveryDates as Record<string, string> ?? {}) }
    for (const [id, date] of Object.entries(local.completedDiscoveryDates as Record<string, string> ?? {})) {
      if (!mergedDates[id] || timestamp(date) > timestamp(mergedDates[id])) mergedDates[id] = date
    }
    return {
      ...base,
      introduced: Boolean(base.introduced),
      parentCompleted: Boolean(base.parentCompleted),
      mastery: Math.max(Number(local.mastery ?? 0), Number(remote.mastery ?? 0)),
      correctAnswers: Math.max(Number(local.correctAnswers ?? 0), Number(remote.correctAnswers ?? 0)),
      wrongAnswers: Math.max(Number(local.wrongAnswers ?? 0), Number(remote.wrongAnswers ?? 0)),
      seenDiscoveries: [...new Set([...stringValues(local.seenDiscoveries), ...stringValues(remote.seenDiscoveries)])],
      completedDiscoveries: [...new Set([...stringValues(local.completedDiscoveries), ...stringValues(remote.completedDiscoveries)])],
      completedDiscoveryDates: mergedDates,
      lastPracticedAt: latestString(local.lastPracticedAt, remote.lastPracticedAt),
      updatedAt,
    }
  }
  if (tableName === 'challengeProgress') {
    return {
      ...base,
      progress: Math.max(Number(local.progress ?? 0), Number(remote.progress ?? 0)),
      completedAt: latestString(local.completedAt, remote.completedAt),
      updatedAt,
    }
  }
  if (tableName === 'sessions') {
    const answers = new Map<string, Record<string, unknown>>()
    for (const answer of [...recordValues(remote.answers), ...recordValues(local.answers)]) {
      const key = `${String(answer.conceptId ?? '')}:${String(answer.questionId ?? '')}`
      if (!answers.has(key)) answers.set(key, answer)
    }
    return {
      ...base,
      answers: [...answers.values()],
      xpEarned: Math.max(Number(local.xpEarned ?? 0), Number(remote.xpEarned ?? 0)),
      completedAt: latestString(local.completedAt, remote.completedAt),
      updatedAt,
    }
  }
  return { ...base, updatedAt }
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function recordValues(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : []
}

function latestString(left: unknown, right: unknown): string | undefined {
  const leftValue = typeof left === 'string' ? left : undefined
  const rightValue = typeof right === 'string' ? right : undefined
  if (!leftValue) return rightValue
  if (!rightValue) return leftValue
  return timestamp(leftValue) >= timestamp(rightValue) ? leftValue : rightValue
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function fetchRemoteRows(remoteTable: string): Promise<SupabaseProgressRow[]> {
  return SupabaseProgressRepository.list(remoteTable)
}

async function fetchTombstones(remoteTable: string): Promise<SupabaseTombstone[]> {
  return SupabaseProgressRepository.listTombstones(remoteTable)
}

async function clearOutbox(entry: SyncOutboxEntry): Promise<void> {
  const current = await database.syncOutbox.get(entry.id)
  if (current?.changedAt === entry.changedAt) await database.syncOutbox.delete(entry.id)
}

async function pushRecord(userId: string, remoteTable: string, tableName: SyncTableName, record: SyncRecord): Promise<void> {
  if (!supabaseClient) return
  const updatedAt = record.updatedAt ?? new Date().toISOString()
  const payload = { ...record, updatedAt }
  await SupabaseProgressRepository.upsert(remoteTable, userId, childIdFor(tableName, record), record.id, payload, updatedAt)
  await SupabaseProgressRepository.deleteTombstone(userId, remoteTable, record.id)
  if (!record.updatedAt) {
    await withSyncSuppressed(() => localTable(tableName).put(payload))
  }
}

async function processDeletes(userId: string, entries: SyncOutboxEntry[]): Promise<void> {
  if (!supabaseClient) return
  for (const entry of entries.filter(({ operation }) => operation === 'delete')) {
    const entity = entities.find(({ local }) => local === entry.tableName)
    if (!entity) continue
    const remoteUpdatedAt = await SupabaseProgressRepository.getUpdatedAt(entity.remote, entry.recordId)
    if (!remoteUpdatedAt || timestamp(entry.changedAt) >= timestamp(remoteUpdatedAt)) {
      await SupabaseProgressRepository.delete(entity.remote, userId, entry.recordId)
      await SupabaseProgressRepository.upsertTombstone(userId, entity.remote, entry.recordId, entry.changedAt)
    }
    await clearOutbox(entry)
  }
}

async function mergeEntity(userId: string, localName: SyncTableName, remoteName: string): Promise<void> {
  if (!supabaseClient) return
  const table = localTable(localName)
  const [remoteRows, tombstones, localRows] = await Promise.all([
    fetchRemoteRows(remoteName),
    fetchTombstones(remoteName),
    table.toArray(),
  ])
  const remoteById = new Map(remoteRows.map((row) => [row.record_id, row]))
  const localById = new Map(localRows.map((row) => [row.id, row]))
  const tombstoneById = new Map(tombstones.map((row) => [row.record_id, row]))

  await withSyncSuppressed(async () => {
    for (const tombstone of tombstones) {
      const local = localById.get(tombstone.record_id)
      const remote = remoteById.get(tombstone.record_id)
      const newestRowAt = Math.max(timestamp(local?.updatedAt), timestamp(remote?.updated_at))
      if (timestamp(tombstone.changed_at) >= newestRowAt) {
        if (local && localName === 'profiles') await deleteLocalProfileAndChildren(tombstone.record_id)
        else if (local) await table.delete(tombstone.record_id)
        remoteById.delete(tombstone.record_id)
        localById.delete(tombstone.record_id)
        const queued = await database.syncOutbox.get(`${localName}:${tombstone.record_id}`)
        if (queued) await clearOutbox(queued)
      }
    }
  })

  for (const remote of remoteById.values()) {
    const payload = rowPayload(remote.payload)
    if (!payload) continue
    const local = localById.get(remote.record_id)
    if (!local) {
      const remoteRecord = { ...payload, updatedAt: remote.updated_at }
      await withSyncSuppressed(() => table.put(remoteRecord))
      localById.set(remote.record_id, remoteRecord)
      continue
    }
    const merged = mergeRecord(local, payload, localName, remote.updated_at)
    await withSyncSuppressed(() => table.put(merged))
    localById.set(remote.record_id, merged)
    if (stableJson(merged) !== stableJson({ ...payload, updatedAt: remote.updated_at })) {
      await pushRecord(userId, remoteName, localName, merged)
    }
  }

  for (const local of localById.values()) {
    const tombstone = tombstoneById.get(local.id)
    if (!remoteById.has(local.id) && (!tombstone || timestamp(local.updatedAt) > timestamp(tombstone.changed_at))) {
      await pushRecord(userId, remoteName, localName, local)
    }
    const outboxEntry = await database.syncOutbox.get(`${localName}:${local.id}`)
    if (outboxEntry?.operation === 'upsert') await clearOutbox(outboxEntry)
  }
}

async function deleteLocalProfileAndChildren(profileId: string): Promise<void> {
  await withSyncSuppressed(() => database.transaction(
    'rw',
    [database.profiles, database.progress, database.learningPathProgress, database.sessions, database.achievements, database.challengeProgress, database.syncOutbox],
    async () => {
      for (const table of [database.progress, database.learningPathProgress, database.sessions, database.achievements, database.challengeProgress]) {
        const rows = await table.where('profileId').equals(profileId).toArray()
        await table.where('profileId').equals(profileId).delete()
        await database.syncOutbox.bulkDelete(rows.map(({ id }) => `${table.name}:${id}`))
      }
      await database.profiles.delete(profileId)
      await database.syncOutbox.delete(`profiles:${profileId}`)
    },
  ))
}

async function reconcileConceptAnswers(userId: string): Promise<void> {
  const [sessions, progressRows] = await Promise.all([database.sessions.toArray(), database.progress.toArray()])
  const totals = new Map<string, { correct: number; wrong: number; updatedAt?: string }>()
  for (const session of sessions as PlaySession[]) {
    for (const answer of session.answers) {
      const conceptId = answer.conceptId ?? session.conceptId
      const value = totals.get(`${session.profileId}:${conceptId}`) ?? { correct: 0, wrong: 0 }
      value.correct += Number(answer.correct)
      value.wrong += Number(!answer.correct)
      value.updatedAt = latestString(value.updatedAt, session.updatedAt)
      totals.set(`${session.profileId}:${conceptId}`, value)
    }
  }

  for (const stored of progressRows as ConceptProgress[]) {
    const count = totals.get(`${stored.profileId}:${stored.conceptId}`)
    if (!count || (stored.correctAnswers === count.correct && stored.wrongAnswers === count.wrong)) continue
    const total = count.correct + count.wrong
    const updatedAt = latestString(stored.updatedAt, count.updatedAt) ?? new Date().toISOString()
    const progress: ConceptProgress = {
      ...stored,
      correctAnswers: count.correct,
      wrongAnswers: count.wrong,
      mastery: Math.round((count.correct / Math.max(total, 5)) * 100),
      updatedAt,
    }
    await withSyncSuppressed(() => database.progress.put(progress))
    await pushRecord(userId, 'child_concept_progress', 'progress', progress as unknown as SyncRecord)
  }
}

function pendingCount(): Promise<number> {
  return database.syncOutbox.count()
}

let activeSync: Promise<SyncResult> | undefined

async function runSync(): Promise<SyncResult> {
  if (!supabaseClient) return { configured: false, authenticated: false, pendingCount: await pendingCount() }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { configured: true, authenticated: false, pendingCount: await pendingCount(), error: 'offline' }
  }

  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) return { configured: true, authenticated: false, pendingCount: await pendingCount() }
    const localOwner = await database.syncState.get('local-owner')
    if (localOwner && localOwner.userId !== session.user.id) {
      return {
        configured: true,
        authenticated: true,
        pendingCount: await pendingCount(),
        error: 'Den här enhetens lokala data är kopplad till ett annat föräldrakonto. Logga in med det kontot för att synka.',
      }
    }
    if (!localOwner) await database.syncState.put({ id: 'local-owner', userId: session.user.id })

    const outbox = await database.syncOutbox.toArray()
    await processDeletes(session.user.id, outbox)
    for (const entity of entities) await mergeEntity(session.user.id, entity.local, entity.remote)
    await reconcileConceptAnswers(session.user.id)

    const syncedAt = new Date().toISOString()
    await database.syncState.put({ id: session.user.id, userId: session.user.id, lastSyncedAt: syncedAt })
    await database.syncState.put({ id: 'local-owner', userId: session.user.id, lastSyncedAt: syncedAt })
    return { configured: true, authenticated: true, syncedAt, pendingCount: await pendingCount() }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synkroniseringen misslyckades.'
    const session = (await supabaseClient.auth.getSession()).data.session
    if (session) await database.syncState.put({ id: session.user.id, userId: session.user.id, lastError: message })
    return { configured: true, authenticated: Boolean(session), pendingCount: await pendingCount(), error: message }
  }
}

export const CloudSyncService = {
  isConfigured: () => supabaseConfigured,
  getSession: async (): Promise<Session | null> => {
    if (!supabaseClient) return null
    const { data, error } = await supabaseClient.auth.getSession()
    if (error) throw error
    return data.session
  },
  signIn: async (email: string, password: string) => {
    if (!supabaseClient) throw new Error('Molnsynk är inte konfigurerad ännu.')
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },
  signUp: async (email: string, password: string) => {
    if (!supabaseClient) throw new Error('Molnsynk är inte konfigurerad ännu.')
    const { data, error } = await supabaseClient.auth.signUp({ email, password })
    if (error) throw error
    return data
  },
  signOut: async () => {
    if (!supabaseClient) return
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw error
  },
  onAuthStateChange: (callback: (session: Session | null) => void) => {
    if (!supabaseClient) return () => undefined
    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => callback(session))
    return () => data.subscription.unsubscribe()
  },
  syncNow: (): Promise<SyncResult> => {
    if (!activeSync) activeSync = runSync().finally(() => { activeSync = undefined })
    return activeSync
  },
  startBackgroundSync: () => {
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void CloudSyncService.syncNow() }, 500)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') schedule() }
    window.addEventListener('knowledge-portal:sync-needed', schedule)
    window.addEventListener('online', schedule)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('knowledge-portal:sync-needed', schedule)
      window.removeEventListener('online', schedule)
      document.removeEventListener('visibilitychange', onVisible)
    }
  },
}
