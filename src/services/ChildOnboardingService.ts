import { database } from '../data/database'
import type { ChildLearningPathProgress, ContentPackage, PlacementMethod, Question } from '../domain/types'
import { ConceptService } from './ConceptService'

export interface PlacementDomain {
  id: 'mathematics' | 'english' | 'swedish' | 'general' | 'albanian'
  title: string
  emoji: string
  paths: Array<{
    pathId: string
    title: string
    description: string
    concepts: ContentPackage[]
  }>
}

export interface PlacementQuestion extends Question {
  key: string
  conceptId: string
  pathId: string
  pathTitle: string
  domainId: PlacementDomain['id']
  domainTitle: string
  level: number
}

const domainDefinitions: Array<Pick<PlacementDomain, 'id' | 'title' | 'emoji'>> = [
  { id: 'mathematics', title: 'Matematik', emoji: '➕' },
  { id: 'english', title: 'Engelska', emoji: '🔤' },
  { id: 'swedish', title: 'Svenska', emoji: '📚' },
  { id: 'general', title: 'Allmänbildning', emoji: '🌍' },
  { id: 'albanian', title: 'Albanska', emoji: '🗣️' },
]

function getDomainId(subjectId: string): PlacementDomain['id'] | undefined {
  if (subjectId === 'mathematics') return 'mathematics'
  if (subjectId === 'english') return 'english'
  if (subjectId === 'swedish') return 'swedish'
  if (subjectId.startsWith('albanian')) return 'albanian'
  if (['animals', 'space', 'geography', 'general', 'general-knowledge', 'general-questions', 'allmanbildning'].includes(subjectId)) return 'general'
  return undefined
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function getQuestionKey(conceptId: string, questionId: string): string {
  return `${conceptId}:${questionId}`
}

function getMultipleChoiceQuestions(contentPackage: ContentPackage): Question[] {
  return contentPackage.questions.filter((question) => question.type === 'multiple-choice' && question.options?.length)
}

export const ChildOnboardingService = {
  getPlacementDomains(packages: ContentPackage[], readingStartLevel?: number): PlacementDomain[] {
    const paths = new Map<string, PlacementDomain['paths'][number]>()
    for (const contentPackage of packages) {
      const domainId = getDomainId(contentPackage.subject.id)
      if (!domainId) continue
      const existing = paths.get(contentPackage.learningPath.id)
      if (existing) {
        existing.concepts.push(contentPackage)
      } else {
        paths.set(contentPackage.learningPath.id, {
          pathId: contentPackage.learningPath.id,
          title: contentPackage.learningPath.title,
          description: contentPackage.learningPath.description,
          concepts: [contentPackage],
        })
      }
    }

    for (const path of paths.values()) {
      path.concepts.sort((left, right) => left.concept.level - right.concept.level)
    }
    return domainDefinitions.map((domain) => ({
      ...domain,
      paths: [...paths.values()].filter((path) => {
        if (readingStartLevel !== undefined && readingStartLevel === 4 && path.pathId === 'early-reading') return false
        if (readingStartLevel !== undefined && readingStartLevel < 4 && path.pathId === 'reading-comprehension') return false
        const firstPackage = path.concepts[0]
        return firstPackage && getDomainId(firstPackage.subject.id) === domain.id
      }).sort((left, right) => left.title.localeCompare(right.title, 'sv-SE')),
    })).filter((domain) => domain.paths.length > 0)
  },

  buildAssessment(packages: ContentPackage[], readingStartLevel?: number): PlacementQuestion[] {
    const domains = this.getPlacementDomains(packages, readingStartLevel)
    const assessment: PlacementQuestion[] = []
    for (const domain of domains) {
      for (const path of domain.paths) {
        const sampleConcepts = path.concepts.length <= 1
          ? path.concepts
          : [...new Set([0, Math.floor((path.concepts.length - 1) / 2), path.concepts.length - 1])]
            .map((index) => path.concepts[index])
        for (const contentPackage of sampleConcepts) {
          const candidates = shuffle(getMultipleChoiceQuestions(contentPackage))
          const sampleCount = path.concepts.length === 1 ? Math.min(3, candidates.length) : Math.min(1, candidates.length)
          for (const question of candidates.slice(0, sampleCount)) {
            assessment.push({
              ...question,
              key: getQuestionKey(contentPackage.concept.id, question.id),
              conceptId: contentPackage.concept.id,
              pathId: path.pathId,
              pathTitle: path.title,
              domainId: domain.id,
              domainTitle: domain.title,
              level: contentPackage.concept.level,
            })
          }
        }
      }
    }
    return shuffle(assessment)
  },

  estimateStartingConcepts(
    packages: ContentPackage[],
    questions: PlacementQuestion[],
    answers: Record<string, string>,
    readingStartLevel?: number,
  ): ContentPackage[] {
    const domains = this.getPlacementDomains(packages, readingStartLevel)
    return domains.flatMap((domain) => domain.paths.map((path) => {
      const conceptsWithQuestions = path.concepts.filter((contentPackage) => questions.some((question) => (
        question.pathId === path.pathId && question.conceptId === contentPackage.concept.id
      )))
      const passedConcepts = conceptsWithQuestions.filter((contentPackage) => {
        const conceptQuestions = questions.filter((question) => question.conceptId === contentPackage.concept.id)
        const correctCount = conceptQuestions.filter((question) => answers[question.key]?.trim().toLocaleLowerCase('sv-SE') === question.answer.trim().toLocaleLowerCase('sv-SE')).length
        return correctCount / conceptQuestions.length >= 2 / 3
      })
      const minimumLevel = path.pathId === 'early-reading' ? readingStartLevel ?? path.concepts[0].concept.level : path.concepts[0].concept.level
      return passedConcepts.filter(({ concept }) => concept.level >= minimumLevel).at(-1)
        ?? path.concepts.find(({ concept }) => concept.level >= minimumLevel)
        ?? path.concepts[0]
    }).filter((contentPackage): contentPackage is ContentPackage => Boolean(contentPackage)))
  },

  getStartingConcepts(
    packages: ContentPackage[],
    method: PlacementMethod,
    manualLevels: Record<string, number>,
    assessmentQuestions: PlacementQuestion[],
    assessmentAnswers: Record<string, string>,
    readingStartLevel?: number,
  ): ContentPackage[] {
    if (method === 'placement') {
      return this.estimateStartingConcepts(packages, assessmentQuestions, assessmentAnswers, readingStartLevel)
    }
    return this.getPlacementDomains(packages, readingStartLevel).flatMap((domain) => domain.paths.map((path) => {
      if (method === 'beginning') {
        return path.concepts.find(({ concept }) => concept.level === readingStartLevel && path.pathId === 'early-reading') ?? path.concepts[0]
      }
      const requestedLevel = manualLevels[path.pathId]
      const selected = path.concepts.find(({ concept }) => concept.level === requestedLevel)
      if (!selected) throw new Error(`Välj en startnivå för ${path.title}.`)
      return selected
    }))
  },

  async initializeProfile(
    profileId: string,
    method: PlacementMethod,
    startingConcepts: ContentPackage[],
  ): Promise<void> {
    await ConceptService.ensureProgress(profileId)
    const now = new Date().toISOString()
    await database.transaction('rw', database.progress, database.learningPathProgress, async () => {
      for (const contentPackage of startingConcepts) {
        const { concept, learningPath } = contentPackage
        const pathProgress: ChildLearningPathProgress = {
          id: `${profileId}:${learningPath.id}`,
          profileId,
          learningPathId: learningPath.id,
          startingLevel: concept.level,
          currentLevel: concept.level,
          selectedConceptId: concept.id,
          placementMethod: method,
          updatedAt: now,
        }
        await database.learningPathProgress.put(pathProgress)
        const progressId = `${profileId}:${concept.id}`
        const progress = await database.progress.get(progressId)
        if (progress) await database.progress.put({ ...progress, introduced: true })
      }
    })
  },
}