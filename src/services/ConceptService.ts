import { database } from '../data/database'
import type { ConceptProgress } from '../domain/types'
import { ChallengeService } from './ChallengeService'

function progressId(profileId: string, conceptId: string): string {
  return `${profileId}:${conceptId}`
}

export const ConceptService = {
  async ensureProgress(profileId: string): Promise<void> {
    const packages = await database.contentPackages.toArray()
    const storedProgress = await database.progress.where('profileId').equals(profileId).toArray()
    const progressByConcept = new Map(storedProgress.map((progress) => [progress.conceptId, progress]))
    await database.transaction('rw', database.progress, database.learningPathProgress, async () => {
      for (const contentPackage of packages) {
        const id = progressId(profileId, contentPackage.concept.id)
        if (!(await database.progress.get(id))) {
          await database.progress.add({
            id,
            profileId,
            conceptId: contentPackage.concept.id,
            introduced: false,
            mastery: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            seenDiscoveries: [],
            completedDiscoveries: [],
          })
        }
      }

      const pathPackages = new Map<string, typeof packages>()
      for (const contentPackage of packages) {
        const entries = pathPackages.get(contentPackage.learningPath.id) ?? []
        entries.push(contentPackage)
        pathPackages.set(contentPackage.learningPath.id, entries)
      }
      for (const [learningPathId, entries] of pathPackages) {
        const id = `${profileId}:${learningPathId}`
        if (await database.learningPathProgress.get(id)) continue
        const introduced = entries
          .filter(({ concept }) => progressByConcept.get(concept.id)?.introduced)
          .sort((left, right) => right.concept.level - left.concept.level)[0]
        const firstConcept = [...entries].sort((left, right) => left.concept.level - right.concept.level)[0]
        const currentConcept = introduced ?? firstConcept
        await database.learningPathProgress.add({
          id,
          profileId,
          learningPathId,
          startingLevel: firstConcept.concept.level,
          currentLevel: currentConcept.concept.level,
          selectedConceptId: introduced?.concept.id,
          placementMethod: 'beginning',
          updatedAt: new Date().toISOString(),
        })
      }
    })
  },

  async getConceptsWithProgress(profileId: string) {
    const [packages, progress] = await Promise.all([
      database.contentPackages.toArray(),
      database.progress.where('profileId').equals(profileId).toArray(),
    ])
    return packages.map((contentPackage) => {
      const conceptProgress = progress.find((entry) => entry.conceptId === contentPackage.concept.id) ?? {
        id: progressId(profileId, contentPackage.concept.id),
        profileId,
        conceptId: contentPackage.concept.id,
        introduced: false,
        mastery: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        seenDiscoveries: [],
        completedDiscoveries: [],
      }
      return { concept: contentPackage.concept, progress: conceptProgress, contentPackage }
    })
  },

  async introduce(profileId: string, conceptId: string): Promise<void> {
    const id = progressId(profileId, conceptId)
    const contentPackage = await database.contentPackages.where('concept.id').equals(conceptId).first()
    const current = await database.progress.get(id)
    const progress: ConceptProgress = current ?? {
      id,
      profileId,
      conceptId,
      introduced: false,
      mastery: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      seenDiscoveries: [],
      completedDiscoveries: [],
    }
    await database.transaction('rw', database.progress, database.learningPathProgress, async () => {
      await database.progress.put({ ...progress, introduced: true })
      if (!contentPackage) return
      const pathProgressId = `${profileId}:${contentPackage.learningPath.id}`
      const pathProgress = await database.learningPathProgress.get(pathProgressId)
      const level = contentPackage.concept.level
      const currentLevel = pathProgress?.currentLevel ?? 0
      await database.learningPathProgress.put({
        id: pathProgressId,
        profileId,
        learningPathId: contentPackage.learningPath.id,
        startingLevel: pathProgress?.startingLevel ?? level,
        currentLevel: Math.max(currentLevel, level),
        selectedConceptId: level >= currentLevel ? conceptId : pathProgress?.selectedConceptId,
        placementMethod: pathProgress?.placementMethod ?? 'manual',
        updatedAt: new Date().toISOString(),
      })
    })
  },

  async withdrawIntroduction(profileId: string, conceptId: string): Promise<void> {
    const contentPackage = await database.contentPackages.where('concept.id').equals(conceptId).first()
    if (!contentPackage) throw new Error('Konceptet kunde inte hittas.')
    await database.transaction('rw', [database.progress, database.learningPathProgress, database.contentPackages], async () => {
      const current = await database.progress.get(progressId(profileId, conceptId))
      if (!current?.introduced) return
      await database.progress.put({ ...current, introduced: false })

      const [pathPackages, profileProgress] = await Promise.all([
        database.contentPackages.where('learningPath.id').equals(contentPackage.learningPath.id).toArray(),
        database.progress.where('profileId').equals(profileId).toArray(),
      ])
      const progressByConcept = new Map(profileProgress.map((entry) => [entry.conceptId, entry]))
      const introducedConcepts = pathPackages
        .filter((entry) => entry.concept.id !== conceptId && (progressByConcept.get(entry.concept.id)?.introduced || progressByConcept.get(entry.concept.id)?.parentCompleted))
        .sort((left, right) => left.concept.level - right.concept.level)
      const pathProgressId = `${profileId}:${contentPackage.learningPath.id}`
      const pathProgress = await database.learningPathProgress.get(pathProgressId)
      const firstLevel = pathPackages.reduce((first, entry) => Math.min(first, entry.concept.level), contentPackage.concept.level)
      const firstIntroduced = introducedConcepts[0]
      const currentConcept = introducedConcepts.at(-1)
      await database.learningPathProgress.put({
        id: pathProgressId,
        profileId,
        learningPathId: contentPackage.learningPath.id,
        startingLevel: firstIntroduced?.concept.level ?? firstLevel,
        currentLevel: currentConcept?.concept.level ?? firstLevel,
        selectedConceptId: currentConcept?.concept.id,
        placementMethod: pathProgress?.placementMethod ?? 'manual',
        updatedAt: new Date().toISOString(),
      })
    })
  },

  async setParentCompletion(profileId: string, conceptId: string, completed: boolean): Promise<void> {
    const contentPackage = await database.contentPackages.where('concept.id').equals(conceptId).first()
    if (!contentPackage) throw new Error('Konceptet kunde inte hittas.')
    const pathPackages = await database.contentPackages.where('learningPath.id').equals(contentPackage.learningPath.id).toArray()
    const pathProgressId = `${profileId}:${contentPackage.learningPath.id}`
    await database.transaction('rw', database.progress, database.learningPathProgress, async () => {
      const id = progressId(profileId, conceptId)
      const current = await database.progress.get(id)
      const progress: ConceptProgress = current ?? {
        id,
        profileId,
        conceptId,
        introduced: false,
        mastery: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        seenDiscoveries: [],
        completedDiscoveries: [],
      }
      await database.progress.put({ ...progress, parentCompleted: completed })
      const storedProgress = await database.progress.where('profileId').equals(profileId).toArray()
      const progressByConcept = new Map(storedProgress.map((entry) => [entry.conceptId, entry]))
      const completedConcepts = pathPackages
        .filter((entry) => progressByConcept.get(entry.concept.id)?.introduced || progressByConcept.get(entry.concept.id)?.parentCompleted)
        .sort((left, right) => left.concept.level - right.concept.level)
      const currentConcept = completedConcepts.at(-1)
      const firstConcept = pathPackages.reduce((first, entry) => entry.concept.level < first.concept.level ? entry : first)
      const pathProgress = await database.learningPathProgress.get(pathProgressId)
      await database.learningPathProgress.put({
        id: pathProgressId,
        profileId,
        learningPathId: contentPackage.learningPath.id,
        startingLevel: pathProgress?.startingLevel ?? firstConcept.concept.level,
        currentLevel: currentConcept?.concept.level ?? firstConcept.concept.level,
        selectedConceptId: currentConcept?.concept.id,
        placementMethod: pathProgress?.placementMethod ?? 'beginning',
        updatedAt: new Date().toISOString(),
      })
    })
  },

  async markDiscoverySeen(profileId: string, conceptId: string, discoveryId: string): Promise<void> {
    const id = progressId(profileId, conceptId)
    const current = await database.progress.get(id)
    if (!current || current.seenDiscoveries.includes(discoveryId)) return
    await database.progress.put({ ...current, seenDiscoveries: [...current.seenDiscoveries, discoveryId] })
  },

  async completeDiscovery(profileId: string, conceptId: string, discoveryId: string): Promise<void> {
    const id = progressId(profileId, conceptId)
    const current = await database.progress.get(id)
    if (!current) return
    const completedDiscoveries = current.completedDiscoveries ?? []
    if (completedDiscoveries.includes(discoveryId)) return
    const completedAt = new Date().toISOString()
    await database.progress.put({
      ...current,
      seenDiscoveries: current.seenDiscoveries.includes(discoveryId)
        ? current.seenDiscoveries
        : [...current.seenDiscoveries, discoveryId],
      completedDiscoveries: [...completedDiscoveries, discoveryId],
      completedDiscoveryDates: { ...current.completedDiscoveryDates, [discoveryId]: completedAt },
    })
    await ChallengeService.refreshProgress(profileId)
  },
}