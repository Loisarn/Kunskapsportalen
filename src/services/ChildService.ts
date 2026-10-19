import { database, withSyncSuppressed } from '../data/database'
import type { ChildProfile } from '../domain/types'

const initialProfiles: ChildProfile[] = [
  { id: 'matteo', name: 'Lorent', avatar: '🦊', xp: 0, level: 1, streakDays: 0 },
  { id: 'dottern', name: 'Leah', avatar: '🐼', xp: 0, level: 1, streakDays: 0 },
]

const selectedProfileKey = 'knowledge-portal.selected-profile'

export const ChildService = {
  async seedProfiles(seedDefaults = true): Promise<void> {
    if (!seedDefaults) return
    await withSyncSuppressed(() => database.transaction('rw', database.profiles, async () => {
      for (const profile of initialProfiles) {
        const existing = await database.profiles.get(profile.id)
        if (!existing) {
          await database.profiles.add(profile)
        } else if (existing.name !== profile.name) {
          await database.profiles.put({ ...existing, name: profile.name })
        }
      }
    }))
  },

  getProfiles: () => database.profiles.toArray(),
  getProfile: (id: string) => database.profiles.get(id),

  async createProfile(name: string, avatar: string, readingStartLevel: number): Promise<ChildProfile> {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('Skriv barnets namn först.')
    const profile: ChildProfile = {
      id: crypto.randomUUID(),
      name: normalizedName,
      avatar,
      xp: 0,
      level: 1,
      streakDays: 0,
      stars: 0,
      readingStartLevel,
    }
    await database.profiles.add(profile)
    return profile
  },
  async deleteProfile(id: string): Promise<void> {
    const changedAt = new Date().toISOString()
    await database.transaction('rw', [database.profiles, database.progress, database.learningPathProgress, database.sessions, database.achievements, database.challengeProgress, database.syncOutbox], async () => {
      await database.progress.where('profileId').equals(id).delete()
      await database.learningPathProgress.where('profileId').equals(id).delete()
      await database.sessions.where('profileId').equals(id).delete()
      await database.achievements.where('profileId').equals(id).delete()
      await database.challengeProgress.where('profileId').equals(id).delete()
      await database.syncOutbox.put({ id: `profiles:${id}`, tableName: 'profiles', recordId: id, operation: 'delete', changedAt })
      await database.profiles.delete(id)
    })
  },

  async getSelectedProfile(): Promise<ChildProfile | undefined> {
    const id = localStorage.getItem(selectedProfileKey)
    return id ? database.profiles.get(id) : undefined
  },

  async selectProfile(id: string): Promise<ChildProfile> {
    const profile = await database.profiles.get(id)
    if (!profile) throw new Error('Profile not found.')
    localStorage.setItem(selectedProfileKey, id)
    return profile
  },
}