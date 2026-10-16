import { database } from '../data/database'
import type { AnswerFeedback, PlaySession, Question } from '../domain/types'
import { ChallengeService } from './ChallengeService'

export interface SessionQuestion extends Question {
  conceptId: string
}

interface QuestionCandidate {
  question: SessionQuestion
  mastery: number
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function getUniqueQuestionPool(candidates: QuestionCandidate[]): QuestionCandidate[] {
  const questionKeys = new Set<string>()
  const promptKeys = new Set<string>()
  return candidates.filter(({ question }) => {
    const questionKey = `${question.conceptId}:${question.id}`
    const promptKey = question.prompt.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE')
    if (questionKeys.has(questionKey) || promptKeys.has(promptKey)) return false
    questionKeys.add(questionKey)
    promptKeys.add(promptKey)
    return true
  })
}

function selectQuestions(pool: QuestionCandidate[], count: number): SessionQuestion[] {
  const candidatesByConcept = new Map<string, QuestionCandidate[]>()
  for (const candidate of pool) {
    const conceptCandidates = candidatesByConcept.get(candidate.question.conceptId) ?? []
    conceptCandidates.push(candidate)
    candidatesByConcept.set(candidate.question.conceptId, conceptCandidates)
  }

  const prioritizedConcepts = shuffle([...candidatesByConcept.values()]).map((candidates) => {
    const mastery = Math.min(100, Math.max(0, candidates[0].mastery))
    const weight = 1 + (100 - mastery) / 100
    const randomValue = Math.max(Number.EPSILON, Math.random())
    return { candidates, key: randomValue ** (1 / weight) }
  }).sort((left, right) => right.key - left.key)
  const selectedConcepts = prioritizedConcepts.slice(0, count)
  const selected = selectedConcepts.map(({ candidates }) => shuffle(candidates)[0])
  const selectedQuestionKeys = new Set(selected.map(({ question }) => `${question.conceptId}:${question.id}`))
  const remaining = pool.filter(({ question }) => !selectedQuestionKeys.has(`${question.conceptId}:${question.id}`))
  const weighted = shuffle(remaining).map((candidate) => {
    const mastery = Math.min(100, Math.max(0, candidate.mastery))
    const weight = 1 + (100 - mastery) / 100
    const randomValue = Math.max(Number.EPSILON, Math.random())
    return { candidate, key: randomValue ** (1 / weight) }
  })
  const remainingCount = Math.max(0, count - selected.length)
  return shuffle([
    ...selected,
    ...weighted.sort((left, right) => right.key - left.key).slice(0, remainingCount).map(({ candidate }) => candidate),
  ])
    .map(({ question }) => question)
}

function normalizeAnswer(value: string): string {
  return value.trim().toLocaleLowerCase('sv-SE')
}

function getToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function getSessionsForDay(profileId: string, date: string): Promise<PlaySession[]> {
  const sessions = await database.sessions.where('profileId').equals(profileId).toArray()
  return sessions
    .filter((session) => getToday(new Date(session.startedAt)) === date)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
}

function getQuestionKey(question: SessionQuestion): string {
  return `${question.conceptId}:${question.id}`
}

async function getQuestionPool(profileId: string): Promise<QuestionCandidate[]> {
  const [introducedProgress, contentPackages] = await Promise.all([
    database.progress.where('profileId').equals(profileId).filter((progress) => progress.introduced).toArray(),
    database.contentPackages.toArray(),
  ])
  if (introducedProgress.length === 0) throw new Error('Be en vuxen öppna ett koncept i föräldraläget först.')

  const progressByConcept = new Map(introducedProgress.map((progress) => [progress.conceptId, progress]))
  return getUniqueQuestionPool(contentPackages.flatMap((contentPackage) => {
    const progress = progressByConcept.get(contentPackage.concept.id)
    if (!progress) return []
    return contentPackage.questions.map((question) => ({
      question: { ...question, conceptId: contentPackage.concept.id },
      mastery: progress.mastery,
    }))
  }))
}

function createSession(profileId: string, questions: SessionQuestion[], dailyDate?: string): PlaySession {
  const conceptIds = [...new Set(questions.map((question) => question.conceptId))]
  return {
    id: crypto.randomUUID(),
    profileId,
    conceptId: conceptIds[0],
    conceptIds,
    startedAt: new Date().toISOString(),
    ...(dailyDate ? { dailyDate } : {}),
    questionKeys: questions.map(getQuestionKey),
    questionSnapshot: questions,
    totalQuestions: questions.length,
    answers: [],
    xpEarned: 0,
  }
}

export const SessionService = {
  async startSession(profileId: string, _conceptId?: string): Promise<{ session: PlaySession; questions: SessionQuestion[] }> {
    void _conceptId
    const questionPool = await getQuestionPool(profileId)
    if (!questionPool.length) {
      throw new Error('Det finns inga frågor bland de öppnade äventyren ännu.')
    }

    const questions = selectQuestions(questionPool, Math.min(20, questionPool.length))
    const session = createSession(profileId, questions)
    await database.sessions.add(session)
    return { session, questions }
  },

  async getDailyAdventureStatus(profileId: string, date = getToday()): Promise<{ session?: PlaySession; questionCount: number; completed: boolean }> {
    const [session] = await getSessionsForDay(profileId, date)
    return { session, questionCount: session?.totalQuestions ?? 20, completed: Boolean(session?.completedAt) }
  },

  async startDailyAdventure(profileId: string): Promise<{ session: PlaySession; questions: SessionQuestion[] }> {
    const dailyDate = getToday()
    const todaysSessions = await getSessionsForDay(profileId, dailyDate)
    let session = todaysSessions.find((entry) => !entry.completedAt)
    let questionPool: QuestionCandidate[] | undefined
    if (!session) {
      questionPool = await getQuestionPool(profileId)
      if (!questionPool.length) {
        throw new Error('Det finns inga frågor bland de öppnade äventyren ännu.')
      }

      const proposedSession = createSession(profileId, selectQuestions(questionPool, Math.min(20, questionPool.length)), todaysSessions.some((entry) => entry.dailyDate === dailyDate) ? undefined : dailyDate)
      session = proposedSession
      await database.transaction('rw', database.sessions, async () => {
        const currentSessions = await getSessionsForDay(profileId, dailyDate)
        const activeSession = currentSessions.find((entry) => !entry.completedAt)
        if (activeSession) {
          session = activeSession
        } else {
          const hasDailyReward = currentSessions.some((entry) => entry.dailyDate === dailyDate)
          session = hasDailyReward ? { ...proposedSession, dailyDate: undefined } : proposedSession
          await database.sessions.add(session)
        }
      })
    }

    if (!session) throw new Error('Äventyret kunde inte startas. Försök igen.')

    let questions = session.questionSnapshot
    if (!questions) {
      questionPool ??= await getQuestionPool(profileId)
      const questionByKey = new Map(questionPool.map(({ question }) => [getQuestionKey(question), question]))
      questions = (session.questionKeys ?? [])
        .map((key) => questionByKey.get(key))
        .filter((question): question is SessionQuestion => Boolean(question))
    }
    if (questions.length !== session.totalQuestions) {
      throw new Error('Dagens äventyr kunde inte laddas. Försök igen när innehållet har synkroniserats.')
    }
    return { session, questions }
  },

  async submitAnswer(sessionId: string, question: Question, answer: string): Promise<AnswerFeedback> {
    const session = await database.sessions.get(sessionId)
    if (!session || session.completedAt) throw new Error('Sessionen är inte aktiv.')
    const conceptId = 'conceptId' in question && typeof question.conceptId === 'string'
      ? question.conceptId
      : session.conceptId
    if (session.answers.some((entry) => entry.questionId === question.id && (entry.conceptId ?? session.conceptId) === conceptId)) {
      throw new Error('Frågan är redan besvarad.')
    }

    const correct = normalizeAnswer(answer) === normalizeAnswer(question.answer)
    const updated: PlaySession = {
      ...session,
      answers: [...session.answers, { conceptId, questionId: question.id, value: answer, correct }],
      xpEarned: session.xpEarned + (correct ? 10 : 0),
    }
    await database.sessions.put(updated)
    await database.transaction('rw', database.progress, async () => {
      const id = `${session.profileId}:${conceptId}`
      const progress = await database.progress.get(id)
      if (progress) {
        const correctAnswers = progress.correctAnswers + Number(correct)
        const wrongAnswers = progress.wrongAnswers + Number(!correct)
        const total = correctAnswers + wrongAnswers
        const masterySampleSize = Math.max(total, 5)
        await database.progress.put({
          ...progress,
          correctAnswers,
          wrongAnswers,
          mastery: Math.round((correctAnswers / masterySampleSize) * 100),
          lastPracticedAt: new Date().toISOString(),
        })
      }
    })

    return { correct, correctAnswer: question.answer, xpEarned: correct ? 10 : 0 }
  },

  async completeSession(sessionId: string): Promise<PlaySession> {
    const session = await database.sessions.get(sessionId)
    if (!session) throw new Error('Sessionen kunde inte hittas.')
    if (session.completedAt) return session
    if (session.answers.length < session.totalQuestions) throw new Error('Besvara alla frågor först.')

    const completed: PlaySession = {
      ...session,
      completedAt: new Date().toISOString(),
      xpEarned: session.xpEarned + (session.dailyDate ? 100 : 50),
    }
    const packages = await database.contentPackages.toArray()
    const albanianConceptIds = new Set(packages
      .filter((contentPackage) => contentPackage.subject.id.startsWith('albanian'))
      .map((contentPackage) => contentPackage.concept.id))
    const answeredAlbanianCorrectly = session.answers.some((answer) => answer.correct && albanianConceptIds.has(answer.conceptId ?? session.conceptId))
    await database.transaction('rw', database.sessions, database.profiles, database.achievements, async () => {
      await database.sessions.put(completed)
      const profile = await database.profiles.get(session.profileId)
      if (profile) {
        const today = getToday()
        const yesterdayDate = new Date()
        yesterdayDate.setDate(yesterdayDate.getDate() - 1)
        const yesterday = getToday(yesterdayDate)
        const streakDays = profile.lastActiveDate === today
          ? profile.streakDays
          : profile.lastActiveDate === yesterday ? profile.streakDays + 1 : 1
        const xp = profile.xp + completed.xpEarned
        await database.profiles.put({
          ...profile,
          xp,
          level: Math.floor(xp / 100) + 1,
          stars: (profile.stars ?? 0) + Number(Boolean(session.dailyDate)),
          streakDays,
          lastActiveDate: today,
        })
        const achievementId = `${profile.id}:first-adventure`
        if (!(await database.achievements.get(achievementId))) {
          await database.achievements.add({
            id: achievementId,
            profileId: profile.id,
            title: 'Första äventyret',
            description: 'Du har klarat ditt första äventyr!',
            emoji: '🏆',
            earnedAt: new Date().toISOString(),
          })
        }
        for (const milestone of [3, 7, 30]) {
          const streakAchievementId = `${profile.id}:streak-${milestone}`
          if (streakDays >= milestone && !(await database.achievements.get(streakAchievementId))) {
            await database.achievements.add({
              id: streakAchievementId,
              profileId: profile.id,
              title: `${milestone} dagar av nyfikenhet`,
              description: `Du har lärt dig något ${milestone} dagar i rad.`,
              emoji: '🔥',
              earnedAt: new Date().toISOString(),
            })
          }
        }
        if (answeredAlbanianCorrectly) {
          const albanianAchievementId = `${profile.id}:albanian-beginner`
          if (!(await database.achievements.get(albanianAchievementId))) {
            await database.achievements.add({
              id: albanianAchievementId,
              profileId: profile.id,
              title: 'Albanska nybörjare',
              description: 'Du har svarat rätt på din första fråga på albanska.',
              emoji: '🗣️',
              earnedAt: new Date().toISOString(),
            })
          }
        }
      }
    })
    await ChallengeService.refreshProgress(session.profileId)
    return completed
  },
}