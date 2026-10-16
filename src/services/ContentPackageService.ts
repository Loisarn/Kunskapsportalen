import { database } from '../data/database'
import type { ContentPackage, KnowledgeCard, QuestionType } from '../domain/types'

const packageFiles = import.meta.glob('../content/**/*.json', {
  import: 'default',
}) as Record<string, () => Promise<unknown>>

const questionTypes: QuestionType[] = ['multiple-choice', 'true-false', 'text']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Content package has an invalid ${field}.`)
  }
  return value
}

export function validateContentPackage(value: unknown): ContentPackage {
  if (!isRecord(value)) throw new Error('Content package must be an object.')
  const subject = value.subject
  const learningPath = value.learningPath
  const concept = value.concept
  const lesson = value.lesson
  if (!isRecord(subject) || !isRecord(learningPath) || !isRecord(concept) || !isRecord(lesson)) {
    throw new Error('Content package needs a subject, learning path, concept, and lesson.')
  }
  if (!Array.isArray(value.discoveries) || !Array.isArray(value.questions) || value.questions.length < 1) {
    throw new Error('Content package needs discoveries and at least one question.')
  }

  const subjectId = requireString(subject.id, 'subject id')
  const pathId = requireString(learningPath.id, 'learning path id')
  const conceptId = requireString(concept.id, 'concept id')
  const conceptSubjectId = requireString(concept.subjectId, 'concept subject id')
  const conceptPathId = requireString(concept.pathId, 'concept path id')
  const level = concept.level
  const difficulty = concept.difficulty
  const requiredMastery = concept.requiredMastery
  if (learningPath.subjectId !== subjectId || conceptSubjectId !== subjectId || conceptPathId !== pathId) {
    throw new Error(`Concept ${conceptId} must reference its package subject and learning path.`)
  }
  if (!Number.isInteger(level) || (level as number) < 1) throw new Error(`Concept ${conceptId} must have a positive integer level.`)
  if (typeof difficulty !== 'number' || !Number.isFinite(difficulty) || difficulty < 1) {
    throw new Error(`Concept ${conceptId} must have a positive difficulty.`)
  }
  if (typeof requiredMastery !== 'number' || requiredMastery < 0 || requiredMastery > 100) {
    throw new Error(`Concept ${conceptId} must have requiredMastery between 0 and 100.`)
  }
  if (!Array.isArray(concept.prerequisites) || concept.prerequisites.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`Concept ${conceptId} must have a list of prerequisite concept IDs.`)
  }
  if (concept.prerequisites.includes(conceptId)) throw new Error(`Concept ${conceptId} cannot be its own prerequisite.`)
  const discoveryMasteryBonus = learningPath.discoveryMasteryBonus ?? 5
  if (typeof discoveryMasteryBonus !== 'number' || discoveryMasteryBonus < 0 || discoveryMasteryBonus > 100) {
    throw new Error(`Learning path ${pathId} must have a discovery mastery bonus between 0 and 100.`)
  }

  const questions = value.questions.map((item, index) => {
    if (!isRecord(item) || !questionTypes.includes(item.type as QuestionType)) {
      throw new Error(`Question ${index + 1} has an unsupported type.`)
    }
    const question = {
      id: requireString(item.id, `question ${index + 1} id`),
      type: item.type as QuestionType,
      prompt: requireString(item.prompt, `question ${index + 1} prompt`),
      answer: requireString(item.answer, `question ${index + 1} answer`),
      ...(Array.isArray(item.options) ? { options: item.options.map((option) => requireString(option, 'answer option')) } : {}),
    }
    if (question.type === 'multiple-choice' && (!question.options || !question.options.includes(question.answer))) {
      throw new Error(`Question ${question.id} must include its answer as an option.`)
    }
    return question
  })

  const discoveries = value.discoveries.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Discovery ${index + 1} is invalid.`)
    const discoveryConceptId = item.conceptId === undefined
      ? conceptId
      : requireString(item.conceptId, `discovery ${index + 1} concept id`)
    if (discoveryConceptId !== conceptId) throw new Error(`Discovery ${item.id} must belong to concept ${conceptId}.`)
    return {
      id: requireString(item.id, `discovery ${index + 1} id`),
      conceptId: discoveryConceptId,
      title: requireString(item.title, `discovery ${index + 1} title`),
      body: requireString(item.body, `discovery ${index + 1} body`),
      emoji: requireString(item.emoji, `discovery ${index + 1} emoji`),
    }
  })
  const knowledgeCards = value.knowledgeCards ?? []
  if (!Array.isArray(knowledgeCards)) throw new Error(`Concept ${conceptId} must have a list of knowledge cards.`)
  const discoveryIds = new Set(discoveries.map((discovery) => discovery.id))
  const cardIds = new Set<string>()
  const parsedKnowledgeCards = knowledgeCards.map((item, index): KnowledgeCard => {
    if (!isRecord(item)) throw new Error(`Knowledge card ${index + 1} is invalid.`)
    const cardId = requireString(item.id, `knowledge card ${index + 1} id`)
    if (cardIds.has(cardId)) throw new Error(`Knowledge card ${cardId} is duplicated.`)
    cardIds.add(cardId)
    const cardConceptId = requireString(item.conceptId, `knowledge card ${index + 1} concept id`)
    if (cardConceptId !== conceptId) throw new Error(`Knowledge card ${cardId} must belong to concept ${conceptId}.`)
    if (!isRecord(item.facts) || Array.isArray(item.facts) || Object.values(item.facts).some((fact) => typeof fact !== 'string')) {
      throw new Error(`Knowledge card ${cardId} must have a map of text facts.`)
    }
    if (item.discoveries !== undefined && (!Array.isArray(item.discoveries) || item.discoveries.some((id) => typeof id !== 'string'))) {
      throw new Error(`Knowledge card ${cardId} must reference a list of discovery IDs.`)
    }
    if (item.emoji !== undefined && typeof item.emoji !== 'string') throw new Error(`Knowledge card ${cardId} has an invalid emoji.`)
    const linkedDiscoveries = item.discoveries as string[] | undefined
    if (linkedDiscoveries?.some((id) => !discoveryIds.has(id))) {
      throw new Error(`Knowledge card ${cardId} references a discovery outside concept ${conceptId}.`)
    }
    return {
      id: cardId,
      conceptId: cardConceptId,
      title: requireString(item.title, `knowledge card ${index + 1} title`),
      description: requireString(item.description, `knowledge card ${index + 1} description`),
      ...(typeof item.emoji === 'string' ? { emoji: item.emoji } : {}),
      facts: item.facts as Record<string, string>,
      ...(linkedDiscoveries ? { discoveries: linkedDiscoveries } : {}),
    }
  })

  return {
    id: requireString(value.id, 'id'),
    subject: { id: subjectId, name: requireString(subject.name, 'subject name') },
    learningPath: {
      id: pathId,
      subjectId,
      title: requireString(learningPath.title, 'learning path title'),
      description: requireString(learningPath.description, 'learning path description'),
      discoveryMasteryBonus,
    },
    concept: {
      id: conceptId,
      subjectId,
      pathId,
      level: level as number,
      title: requireString(concept.title, 'concept title'),
      description: requireString(concept.description, 'concept description'),
      emoji: requireString(concept.emoji, 'concept emoji'),
      difficulty: difficulty as number,
      requiredMastery,
      prerequisites: concept.prerequisites as string[],
    },
    lesson: {
      id: requireString(lesson.id, 'lesson id'),
      title: requireString(lesson.title, 'lesson title'),
      content: requireString(lesson.content, 'lesson content'),
    },
    knowledgeCards: parsedKnowledgeCards,
    discoveries,
    questions,
  }
}

function validatePackageCollection(packages: ContentPackage[]): void {
  const conceptsById = new Map<string, ContentPackage['concept']>()
  const pathsById = new Map<string, ContentPackage['learningPath']>()
  const pathLevels = new Set<string>()
  for (const contentPackage of packages) {
    const { concept } = contentPackage
    const currentPath = pathsById.get(contentPackage.learningPath.id)
    if (currentPath && (
      currentPath.subjectId !== contentPackage.learningPath.subjectId
      || currentPath.title !== contentPackage.learningPath.title
      || currentPath.description !== contentPackage.learningPath.description
      || currentPath.discoveryMasteryBonus !== contentPackage.learningPath.discoveryMasteryBonus
    )) {
      throw new Error(`Learning path ${contentPackage.learningPath.id} has inconsistent package metadata.`)
    }
    pathsById.set(contentPackage.learningPath.id, contentPackage.learningPath)
    if (conceptsById.has(concept.id)) throw new Error(`Concept ${concept.id} is defined by more than one package.`)
    conceptsById.set(concept.id, concept)
    const pathLevel = `${concept.pathId}:${concept.level}`
    if (pathLevels.has(pathLevel)) throw new Error(`Learning path ${concept.pathId} has more than one concept at level ${concept.level}.`)
    pathLevels.add(pathLevel)
  }
  for (const contentPackage of packages) {
    for (const prerequisiteId of contentPackage.concept.prerequisites) {
      if (!conceptsById.has(prerequisiteId)) {
        throw new Error(`Concept ${contentPackage.concept.id} references missing prerequisite ${prerequisiteId}.`)
      }
    }
  }
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (conceptId: string) => {
    if (visiting.has(conceptId)) throw new Error(`Concept prerequisites contain a cycle at ${conceptId}.`)
    if (visited.has(conceptId)) return
    visiting.add(conceptId)
    for (const prerequisiteId of conceptsById.get(conceptId)?.prerequisites ?? []) visit(prerequisiteId)
    visiting.delete(conceptId)
    visited.add(conceptId)
  }
  for (const conceptId of conceptsById.keys()) visit(conceptId)
}

export const ContentPackageService = {
  async loadPackages(): Promise<void> {
    const packages = (await Promise.all(Object.values(packageFiles).map((loadPackage) => loadPackage())))
      .map(validateContentPackage)
    validatePackageCollection(packages)
    await database.transaction('rw', database.contentPackages, database.learningPaths, async () => {
      for (const contentPackage of packages) {
        await database.learningPaths.put(contentPackage.learningPath)
        await database.contentPackages.put(contentPackage)
      }
    })
  },

  getPackages: () => database.contentPackages.toArray(),

  getPackage: (id: string) => database.contentPackages.get(id),
}