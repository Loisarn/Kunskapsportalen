import { database } from '../data/database'
import type { ProgressSummary } from '../domain/types'
import { ConceptService } from './ConceptService'

export const ProgressService = {
  async getSummary(profileId: string): Promise<ProgressSummary | undefined> {
    const profile = await database.profiles.get(profileId)
    if (!profile) return undefined
    const [sessions, achievements, conceptProgress] = await Promise.all([
      database.sessions.where('profileId').equals(profileId).toArray(),
      database.achievements.where('profileId').equals(profileId).toArray(),
      ConceptService.getConceptsWithProgress(profileId),
    ])
    const completedSessions = sessions.filter((session) => session.completedAt)
    const answers = sessions.flatMap((session) => session.answers)
    return {
      profile,
      sessionsCompleted: completedSessions.length,
      questionsAnswered: answers.length,
      correctAnswers: answers.filter((answer) => answer.correct).length,
      achievements,
      conceptProgress: conceptProgress.map(({ concept, progress, contentPackage }) => ({
        concept,
        progress,
        subject: contentPackage.subject,
      })),
    }
  },
}