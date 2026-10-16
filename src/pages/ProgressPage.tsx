import { useEffect, useState } from 'react'
import { BookOpen, Check, ChevronDown, Flame } from 'lucide-react'
import type { ChildProfile } from '../domain/types'
import { LearningPathService } from '../services/LearningPathService'
import { ProgressService } from '../services/ProgressService'

export function ProgressPage({ profile }: { profile: ChildProfile }) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof ProgressService.getSummary>>>()
  useEffect(() => { void ProgressService.getSummary(profile.id).then(setSummary) }, [profile.id])
  const mastered = summary?.conceptProgress.filter(({ progress }) => progress.mastery >= 70) ?? []
  const allConcepts = summary?.conceptProgress ?? []
  const [learningPathDashboard, setLearningPathDashboard] = useState<Awaited<ReturnType<typeof LearningPathService.getDashboard>>>()
  useEffect(() => { void LearningPathService.getDashboard(profile.id).then(setLearningPathDashboard) }, [profile.id])
  const generalSubjectIds = ['animals', 'space', 'geography', 'general', 'general-questions', 'general-knowledge', 'allmanbildning']
  const subjectDefinitions: Array<{
    id: string
    title: string
    emoji: string
    matches: (subjectId: string, subjectName?: string) => boolean
  }> = [
    { id: 'mathematics', title: 'Matematik', emoji: '➕', matches: (subjectId) => subjectId === 'mathematics' },
    { id: 'swedish', title: 'Svenska', emoji: '📚', matches: (subjectId) => subjectId === 'swedish' },
    { id: 'english', title: 'Engelska', emoji: '🔤', matches: (subjectId) => subjectId === 'english' },
    { id: 'albanian', title: 'Albanska', emoji: '🗣️', matches: (subjectId) => subjectId.startsWith('albanian') },
    { id: 'general', title: 'Allmänna frågor', emoji: '🌍', matches: (subjectId, subjectName = '') => generalSubjectIds.includes(subjectId) || /allmän|general/i.test(subjectName) },
  ]
  const subjectGroups = subjectDefinitions.map((subject) => {
    const concepts = allConcepts.filter(({ subject: packageSubject }) => subject.matches(packageSubject.id, packageSubject.name))
    const practiceConcepts = concepts.filter(({ progress }) => progress.mastery < 70)
    return {
      ...subject,
      concepts,
      practiceConcepts,
      averageMastery: concepts.length ? Math.round(concepts.reduce((total, entry) => total + entry.progress.mastery, 0) / concepts.length) : 0,
    }
  })
  const accuracy = summary?.questionsAnswered ? Math.round((summary.correctAnswers / summary.questionsAnswered) * 100) : 0
  const remainder = profile.xp % 100
  return <div className="progress-page page-enter"><div className="page-title-row"><div><p className="eyebrow">DU ÄR PÅ VÄG!</p><h1>Framsteg</h1><p className="page-subtitle">Varje fråga gör dig lite klokare.</p></div><span className="progress-page-avatar">{profile.avatar}</span></div>
    <section className="path-progress-section"><div className="section-heading"><div><p className="eyebrow">DIN LÄRRESA</p><h2>Start och aktuell nivå</h2></div><span className="panel-emoji">🧭</span></div><div className="path-progress-grid">{learningPathDashboard?.learningPaths.map(({ learningPath, concepts: pathConcepts, progress }) => {
      const currentConcept = pathConcepts.find(({ concept }) => concept.level === progress.currentLevel)
      return <article className="path-progress-item" key={learningPath.id}><div><span>{learningPath.title}</span><strong>Nivå {progress.currentLevel}</strong></div><small>Startade på nivå {progress.startingLevel}{currentConcept ? ` · ${currentConcept.concept.title}` : ''}</small><span className="path-progress-track"><i style={{ width: `${pathConcepts.length ? (progress.currentLevel / Math.max(...pathConcepts.map(({ concept }) => concept.level))) * 100 : 0}%` }} /></span></article>
    })}</div></section>
    <section className="level-overview"><div className="level-badge"><span>✦</span><small>BELÖNINGSNIVÅ</small><strong>{profile.level}</strong></div><div className="level-copy"><p className="eyebrow">XP-BELÖNINGAR</p><h2>Stjärnsamlare</h2><p>Du har samlat <strong>{profile.xp} stjärnpoäng</strong> och <strong>{profile.stars ?? 0} äventyrsstjärnor</strong>. Fortsätt upptäcka för att få fler belöningar!</p><div className="level-bar"><span><i style={{ width: `${remainder}%` }} /></span><small>{remainder} / 100 XP till nästa belöningsnivå</small></div></div><div className="level-sparkle">✨</div></section>
    <section className="progress-metrics"><div className="metric-box"><span className="metric-icon metric-purple"><BookOpen size={19} /></span><span>ÄVENTYR KLARA</span><strong>{summary?.sessionsCompleted ?? 0}</strong><small>hela äventyr</small></div><div className="metric-box"><span className="metric-icon metric-green"><Check size={19} /></span><span>TRÄFFSÄKERHET</span><strong>{accuracy}<small>%</small></strong><small>{summary?.correctAnswers ?? 0} rätt av {summary?.questionsAnswered ?? 0}</small></div><div className="metric-box"><span className="metric-icon metric-orange"><Flame size={19} /></span><span>DAGAR I RAD</span><strong>{profile.streakDays}</strong><small>dagar av nyfikenhet</small></div></section>
    <div className="progress-content-grid"><section className="progress-panel"><div className="section-heading"><div><p className="eyebrow">DET HÄR KAN DU REDAN</p><h2>Styrkor</h2></div><span className="panel-emoji">💪</span></div>{mastered.length ? mastered.map(({ concept, progress: item }) => <div className="mastery-row" key={concept.id}><span className="mastery-emoji">{concept.emoji}</span><span className="mastery-info"><strong>{concept.title}</strong><span className="mastery-track"><i style={{ width: `${item.mastery}%` }} /></span></span><span className="mastery-percent">{item.mastery}%</span></div>) : <div className="progress-empty"><span>🌱</span><p>Här växer snart dina styrkor. Fortsätt öva!</p></div>}</section>
      <section className="progress-panel practice-panel"><div className="section-heading"><div><p className="eyebrow">BRA ATT ÖVA LITE TILL</p><h2>Träna mer</h2></div><span className="panel-emoji">🧠</span></div><div className="practice-subject-list">{subjectGroups.map((subject) => <details className="practice-subject" key={subject.id}><summary className="practice-subject-summary"><span className={`practice-subject-icon practice-subject-${subject.id}`}>{subject.emoji}</span><span className="practice-subject-info"><strong>{subject.title}</strong><small>{subject.id === 'general' && subject.concepts.length === 0 ? 'Kommer senare' : `${subject.practiceConcepts.length} att öva · ${subject.averageMastery}% i snitt`}</small></span><span className="practice-subject-count">{subject.id === 'general' && subject.concepts.length === 0 ? 'Snart' : subject.practiceConcepts.length}</span><ChevronDown className="practice-subject-chevron" size={16} /></summary><div className="practice-subject-content">{subject.practiceConcepts.length ? subject.practiceConcepts.map(({ concept, progress: item }) => <div className="mastery-row" key={concept.id}><span className="mastery-emoji">{concept.emoji}</span><span className="mastery-info"><strong>{concept.title}</strong><span className="mastery-track"><i style={{ width: `${item.mastery}%` }} /></span></span><span className="mastery-percent">{item.mastery}%</span></div>) : <p className="practice-subject-empty">{subject.id === 'general' ? 'Allmänna frågor dyker upp här när de läggs till.' : 'Inga koncept att träna just nu.'}</p>}</div></details>)}</div></section></div>
    <section className="achievement-section"><div className="section-heading"><div><p className="eyebrow">SMÅ OCH STORA SEGRAR</p><h2>Medaljer</h2></div><span className="achievement-count">{summary?.achievements.length ?? 0} upplåsta</span></div>{summary?.achievements.length ? <div className="achievement-grid">{summary.achievements.map((achievement) => <div className="achievement-card" key={achievement.id}><span>{achievement.emoji}</span><div><strong>{achievement.title}</strong><small>{achievement.description}</small></div><Check size={17} /></div>)}</div> : <div className="locked-achievement"><span>🔒</span><div><strong>Första äventyret</strong><small>Slutför ett äventyr för att låsa upp din första medalj.</small></div><span className="locked-stars">✧ ✧ ✧</span></div>}</section>
  </div>
}