import { database } from '../data/database'
import type { ChildLearningPathProgress, ConceptProgress, ContentPackage, LearningPath } from '../domain/types'

export interface LearningPathConceptEntry {
  concept: ContentPackage['concept']
  progress: ConceptProgress
  contentPackage: ContentPackage
  readiness: number
}

export interface LearningPathGroup {
  learningPath: LearningPath
  concepts: LearningPathConceptEntry[]
  averageMastery: number
  masteredConcepts: number
  progress: ChildLearningPathProgress
}

export interface LearningPathDashboard {
  concepts: LearningPathConceptEntry[]
  learningPaths: LearningPathGroup[]
  recommendedConcepts: LearningPathConceptEntry[]
}

function getProgress(profileId: string, contentPackage: ContentPackage, progressByConcept: Map<string, ConceptProgress>): ConceptProgress {
  return progressByConcept.get(contentPackage.concept.id) ?? {
    id: `${profileId}:${contentPackage.concept.id}`,
    profileId,
    conceptId: contentPackage.concept.id,
    introduced: false,
    mastery: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    seenDiscoveries: [],
    completedDiscoveries: [],
  }
}

function getReadiness(contentPackage: ContentPackage, progress: ConceptProgress): number {
  if (progress.parentCompleted) return 100
  const validCompletions = new Set(progress.completedDiscoveries ?? [])
  const completedCount = contentPackage.discoveries.filter((discovery) => validCompletions.has(discovery.id)).length
  const discoveryBonus = completedCount * contentPackage.learningPath.discoveryMasteryBonus
  return Math.min(100, Math.max(0, Math.round(progress.mastery + discoveryBonus)))
}

function getPrerequisites(
  candidate: ContentPackage,
  concepts: LearningPathConceptEntry[],
  startingLevel: number,
): LearningPathConceptEntry[] | undefined {
  if (candidate.concept.level <= startingLevel) return []
  if (candidate.concept.prerequisites.length === 0 && candidate.concept.level > 1 && !concepts.some(({ concept }) => (
    concept.pathId === candidate.concept.pathId && concept.level === candidate.concept.level - 1
  ))) return undefined

  const prerequisiteIds = candidate.concept.prerequisites.length > 0
    ? candidate.concept.prerequisites
    : candidate.concept.level > 1
      ? concepts
        .filter(({ concept }) => concept.pathId === candidate.concept.pathId && concept.level === candidate.concept.level - 1)
        .map(({ concept }) => concept.id)
      : []

  const prerequisites = prerequisiteIds.map((id) => concepts.find(({ concept }) => concept.id === id))
  if (prerequisites.some((entry) => !entry)) return undefined
  return prerequisites as LearningPathConceptEntry[]
}

export const LearningPathService = {
  async getDashboard(profileId: string): Promise<LearningPathDashboard> {
    const [paths, packages, storedProgress, storedPathProgress, profile] = await Promise.all([
      database.learningPaths.toArray(),
      database.contentPackages.toArray(),
      database.progress.where('profileId').equals(profileId).toArray(),
      database.learningPathProgress.where('profileId').equals(profileId).toArray(),
      database.profiles.get(profileId),
    ])
    const progressByConcept = new Map(storedProgress.map((progress) => [progress.conceptId, progress]))
    const pathProgressById = new Map(storedPathProgress.map((progress) => [progress.learningPathId, progress]))
    const concepts = packages.map((contentPackage) => {
      const progress = getProgress(profileId, contentPackage, progressByConcept)
      return {
        concept: contentPackage.concept,
        progress,
        contentPackage,
        readiness: getReadiness(contentPackage, progress),
      }
    })

    const recommendedConcepts = concepts.filter(({ concept, progress }) => {
      if (progress.introduced || progress.parentCompleted) return false
      if (concept.pathId === 'reading-comprehension' && profile?.readingStartLevel !== undefined && profile.readingStartLevel < 4) {
        const finalReadingConcept = concepts.find(({ concept: entry }) => entry.id === 'early-reading-3')
        if (!finalReadingConcept || finalReadingConcept.readiness < finalReadingConcept.concept.requiredMastery) return false
      }
      const pathConcepts = concepts.filter(({ concept: pathConcept }) => pathConcept.pathId === concept.pathId)
      const startingLevel = pathProgressById.get(concept.pathId)?.startingLevel
        ?? Math.min(...pathConcepts.map(({ concept: pathConcept }) => pathConcept.level))
      if (concept.level < startingLevel) return false
      const prerequisites = getPrerequisites(
        packages.find((contentPackage) => contentPackage.concept.id === concept.id)!,
        concepts,
        startingLevel,
      )
      return prerequisites?.every((prerequisite) => prerequisite.readiness >= prerequisite.concept.requiredMastery) ?? false
    }).sort((left, right) => left.concept.level - right.concept.level || left.concept.title.localeCompare(right.concept.title))

    const learningPaths = paths.map((learningPath) => {
      const pathConcepts = concepts
        .filter(({ concept }) => concept.pathId === learningPath.id)
        .sort((left, right) => left.concept.level - right.concept.level)
      const introducedConcepts = pathConcepts.filter(({ progress }) => progress.introduced)
      const firstConcept = pathConcepts[0]
      const pathProgress = pathProgressById.get(learningPath.id) ?? {
        id: `${profileId}:${learningPath.id}`,
        profileId,
        learningPathId: learningPath.id,
        startingLevel: firstConcept?.concept.level ?? 1,
        currentLevel: firstConcept?.concept.level ?? 1,
        selectedConceptId: undefined,
        placementMethod: 'beginning' as const,
        updatedAt: '',
      }
      return {
        learningPath,
        concepts: pathConcepts,
        progress: pathProgress,
        averageMastery: introducedConcepts.length
          ? Math.round(introducedConcepts.reduce((total, entry) => total + entry.progress.mastery, 0) / introducedConcepts.length)
          : 0,
        masteredConcepts: pathConcepts.filter(({ progress, concept }) => progress.parentCompleted || (progress.introduced && progress.mastery >= concept.requiredMastery)).length,
      }
    })

    return { concepts, learningPaths, recommendedConcepts }
  },
}