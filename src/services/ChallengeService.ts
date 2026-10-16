import { database } from '../data/database'
import type { Challenge, ChildChallengeProgress, ContentPackage } from '../domain/types'

export interface WeeklyChallengeEntry {
  challenge: Challenge
  progress: ChildChallengeProgress
}

function getLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekStart(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}

function getChallenges(packages: ContentPackage[]): Challenge[] {
  const pathForSubject = new Map<string, string>(packages.map((contentPackage) => [contentPackage.subject.id, contentPackage.learningPath.id]))
  const challenges: Challenge[] = []
  const spacePath = pathForSubject.get('space')
  const animalPath = pathForSubject.get('animals')
  const readingPath = packages.find((contentPackage) => contentPackage.learningPath.id === 'reading-comprehension')?.learningPath.id
  if (spacePath) challenges.push({
    id: 'space-explorer',
    title: 'Rymdutforskare',
    description: 'Upptäck tre rymdfakta den här veckan.',
    type: 'discoveries',
    target: 3,
    rewardXp: 100,
    rewardBadge: 'Space Explorer',
    pathId: spacePath,
  })
  if (animalPath) challenges.push({
    id: 'animal-expert',
    title: 'Djurvän',
    description: 'Upptäck tre djurfakta den här veckan.',
    type: 'discoveries',
    target: 3,
    rewardXp: 100,
    rewardBadge: 'Animal Expert',
    pathId: animalPath,
  })
  if (readingPath) challenges.push({
    id: 'reading-hero',
    title: 'Läshjälte',
    description: 'Svara på 30 läsfrågor den här veckan.',
    type: 'questions',
    target: 30,
    rewardXp: 100,
    rewardBadge: 'Reading Hero',
    pathId: readingPath,
  })
  if (packages.length) challenges.push({
    id: 'discovery-expert',
    title: 'Nyfiken upptäckare',
    description: 'Upptäck fem nya fakta den här veckan.',
    type: 'discoveries',
    target: 5,
    rewardXp: 75,
    rewardBadge: 'Discovery Expert',
  })
  return challenges
}

function getBadgeEmoji(challenge: Challenge): string {
  if (challenge.pathId?.includes('space')) return '🪐'
  if (challenge.pathId?.includes('animal')) return '🐾'
  if (challenge.pathId?.includes('reading')) return '📚'
  return '🔭'
}

export const ChallengeService = {
  async getWeeklyChallenges(profileId: string, now = new Date()): Promise<WeeklyChallengeEntry[]> {
    const packages = await database.contentPackages.toArray()
    const challenges = getChallenges(packages)
    await database.challenges.bulkPut(challenges)
    const weekStart = getWeekStart(now)
    const weekKey = getLocalDate(weekStart)
    const weekStartTime = weekStart.getTime()
    const [sessions, conceptProgress] = await Promise.all([
      database.sessions.where('profileId').equals(profileId).toArray(),
      database.progress.where('profileId').equals(profileId).toArray(),
    ])
    const progressByConcept = new Map(conceptProgress.map((progress) => [progress.conceptId, progress]))
    const packageByConcept = new Map(packages.map((contentPackage) => [contentPackage.concept.id, contentPackage]))
    const completedThisWeek = sessions.filter((session) => session.completedAt && new Date(session.completedAt).getTime() >= weekStartTime)

    const values = new Map<string, number>()
    for (const challenge of challenges) {
      let value = 0
      if (challenge.type === 'discoveries') {
        for (const progress of conceptProgress) {
          const contentPackage = packageByConcept.get(progress.conceptId)
          if (!contentPackage || (challenge.pathId && contentPackage.learningPath.id !== challenge.pathId)) continue
          value += Object.values(progress.completedDiscoveryDates ?? {}).filter((completedAt) => new Date(completedAt).getTime() >= weekStartTime).length
        }
      } else if (challenge.type === 'questions') {
        for (const session of completedThisWeek) {
          value += session.answers.filter((answer) => {
            const contentPackage = packageByConcept.get(answer.conceptId ?? session.conceptId)
            return !challenge.pathId || contentPackage?.learningPath.id === challenge.pathId
          }).length
        }
      } else if (challenge.type === 'mastery') {
        value = packages.filter((contentPackage) => !challenge.pathId || contentPackage.learningPath.id === challenge.pathId)
          .filter((contentPackage) => (progressByConcept.get(contentPackage.concept.id)?.mastery ?? 0) >= contentPackage.concept.requiredMastery).length
      }
      values.set(challenge.id, Math.min(challenge.target, value))
    }

    const entries = new Map<string, ChildChallengeProgress>()
    await database.transaction('rw', database.challengeProgress, database.profiles, database.achievements, async () => {
      for (const challenge of challenges) {
        const id = `${profileId}:${weekKey}:${challenge.id}`
        const previous = await database.challengeProgress.get(id)
        const value = values.get(challenge.id) ?? 0
        const completedAt = previous?.completedAt ?? (value >= challenge.target ? now.toISOString() : undefined)
        const progress: ChildChallengeProgress = { id, profileId, challengeId: challenge.id, weekKey, progress: value, completedAt }
        await database.challengeProgress.put(progress)
        entries.set(challenge.id, progress)

        if (completedAt && !previous?.completedAt) {
          const profile = await database.profiles.get(profileId)
          if (profile) {
            const xp = profile.xp + challenge.rewardXp
            await database.profiles.put({ ...profile, xp, level: Math.floor(xp / 100) + 1 })
          }
          if (challenge.rewardBadge) {
            const achievementId = `${profileId}:${challenge.id}`
            if (!(await database.achievements.get(achievementId))) {
              await database.achievements.add({
                id: achievementId,
                profileId,
                title: challenge.rewardBadge,
                description: `Du klarade veckans utmaning: ${challenge.title}.`,
                emoji: getBadgeEmoji(challenge),
                earnedAt: now.toISOString(),
              })
            }
          }
        }
      }
    })

    return challenges.map((challenge) => ({
      challenge,
      progress: entries.get(challenge.id)!,
    }))
  },

  async refreshProgress(profileId: string): Promise<void> {
    await this.getWeeklyChallenges(profileId)
  },
}