import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Flame, Heart, Play, Sparkles, Zap } from 'lucide-react'
import type { ChildProfile, PlaySession } from '../domain/types'
import { ChallengeService, type WeeklyChallengeEntry } from '../services/ChallengeService'
import { ConceptService } from '../services/ConceptService'
import { LearningPathService } from '../services/LearningPathService'
import { ProgressService } from '../services/ProgressService'
import { SessionService } from '../services/SessionService'

export function HomePage({ profile, onProfileUpdated }: { profile: ChildProfile; onProfileUpdated: () => Promise<void> }) {
  const navigate = useNavigate()
  const [concepts, setConcepts] = useState<Awaited<ReturnType<typeof ConceptService.getConceptsWithProgress>>>([])
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof ProgressService.getSummary>>>()
  const [learningPaths, setLearningPaths] = useState<Awaited<ReturnType<typeof LearningPathService.getDashboard>>>()
  const [dailyAdventure, setDailyAdventure] = useState<{ session?: PlaySession; questionCount: number; completed: boolean }>({ questionCount: 20, completed: false })
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallengeEntry[]>([])
  useEffect(() => { void Promise.all([
    ConceptService.getConceptsWithProgress(profile.id).then(setConcepts),
    ProgressService.getSummary(profile.id).then(setSummary),
    LearningPathService.getDashboard(profile.id).then(setLearningPaths),
    SessionService.getDailyAdventureStatus(profile.id).then(setDailyAdventure),
    ChallengeService.getWeeklyChallenges(profile.id).then(setWeeklyChallenges),
  ]).then(() => onProfileUpdated()) }, [profile.id, onProfileUpdated])
  const nextConcept = concepts.find(({ progress }) => progress.introduced)
  const availableCount = concepts.filter(({ progress }) => progress.introduced).length
  const startedPathCount = learningPaths?.learningPaths.filter(({ concepts: pathConcepts }) => pathConcepts.some(({ progress }) => progress.introduced)).length ?? 0
  const remainder = profile.xp % 100
  const dailyQuestionCount = dailyAdventure.session?.answers.length ?? 0
  return <div className="home-page page-enter">
    <div className="welcome-row"><div><p className="eyebrow">HEJ {profile.name.toLocaleUpperCase('sv-SE')}!</p><h1>Vad kul att du är här <span className="wave">✋</span></h1></div><div className="daily-note"><span className="daily-note-icon">☀️</span><span>En ny dag,<br /><strong>nya upptäckter</strong></span></div></div>
    <section className="adventure-hero">
      <div className="hero-copy">
        <div className="hero-pill"><Sparkles size={14} /> DAGENS ÄVENTYR</div>
        <h2>Redo för dagens<br />äventyr?</h2>
        <p>{dailyAdventure.completed ? 'Dagens äventyr är klart. Vila nu, så väntar ett nytt äventyr imorgon.' : 'Tjugo blandade frågor väljs från dina öppnade lärvägar.'}</p>
        <div className="daily-adventure-progress"><span><i style={{ width: `${dailyAdventure.completed ? 100 : (dailyQuestionCount / 20) * 100}%` }} /></span><strong>{dailyAdventure.completed ? 20 : dailyQuestionCount} / 20 frågor</strong></div>
        <button className="primary-button hero-button" onClick={() => navigate('/play')} disabled={!availableCount || dailyAdventure.completed}><Play size={18} fill="currentColor" /> {dailyAdventure.completed ? 'Dagens äventyr klart' : dailyQuestionCount ? 'Fortsätt äventyret' : 'Starta äventyr'} {!dailyAdventure.completed && <ArrowRight size={18} />}</button>
        <div className="hero-reward"><span>✨</span> 100 XP och 1 stjärna · Samlade: {profile.stars ?? 0}</div>
      </div>
      <div className="hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><span className="hero-star star-a">✦</span><span className="hero-star star-b">✧</span><span className="hero-planet">🌙</span><span className="hero-mascot">🦊</span><span className="hero-comet">✦</span></div>
      <div className="hero-bottom-line"><span>DIN ÄVENTYRSKARTA</span><span>{dailyAdventure.completed ? 'KLART FÖR IDAG' : availableCount ? 'BLANDADE LÄRVÄGAR' : 'VÄNTAR PÅ EN VUXEN'} <span className="status-dot" /></span></div>
    </section>
    <section className="stats-row" aria-label="Dina poäng">
      <div className="stat-card stat-level"><span className="stat-icon">🧭</span><span className="stat-label">LÄRVÄGAR</span><strong>{startedPathCount}<small>/{learningPaths?.learningPaths.length ?? 0}</small></strong><span className="stat-detail">påbörjade vägar</span></div>
      <div className="stat-card stat-xp"><span className="stat-icon"><Zap size={22} fill="currentColor" /></span><span className="stat-label">STJÄRNPOÄNG</span><strong>{profile.xp}<small> XP</small></strong><span className="mini-progress"><i style={{ width: `${remainder}%` }} /></span><span className="stat-detail">{100 - remainder} XP till nästa belöningsnivå</span></div>
      <div className="stat-card stat-streak"><span className="stat-icon"><Flame size={22} fill="currentColor" /></span><span className="stat-label">DAGAR I RAD</span><strong>{profile.streakDays}</strong><span className="stat-detail">{profile.streakDays === 1 ? 'Fortsätt imorgon!' : 'Varje dag är en ny start'}</span></div>
    </section>
    <div className="home-lower-grid">
      <section className="section-block journey-block"><div className="section-heading"><div><p className="eyebrow">DIN RESA</p><h2>Små steg, stora upptäckter</h2></div><button className="text-link" onClick={() => navigate('/progress')}>Se framsteg <ArrowRight size={15} /></button></div>
        {nextConcept ? <button className="concept-row" onClick={() => navigate('/play')}><span className="concept-emoji">{nextConcept.concept.emoji}</span><span className="concept-info"><strong>{nextConcept.concept.title}</strong><small>{nextConcept.progress.mastery}% upptäckt</small></span><span className="concept-track"><i style={{ width: `${nextConcept.progress.mastery}%` }} /></span><ArrowRight size={18} /></button> : <div className="empty-journey"><span>🗺️</span><div><strong>Kartan väntar på dig</strong><p>Be en vuxen öppna ditt första äventyr i Föräldraläge.</p></div><button aria-label="Öppna föräldraläge" onClick={() => navigate('/parent')}><ArrowRight size={18} /></button></div>}
      </section>
      <section className="section-block little-win-block"><div className="little-win-illustration">{summary?.achievements.length ? summary.achievements[0].emoji : '🏅'}</div><div className="little-win-content"><p className="eyebrow">DIN NÄSTA BELÖNING</p><h3>Första äventyret</h3><p>Slutför ditt första uppdrag och lås upp din allra första medalj.</p><div className="reward-progress"><span><i style={{ width: summary?.sessionsCompleted ? '100%' : '0%' }} /></span><small>{summary?.sessionsCompleted ? 'Klar!' : '0 av 1 uppdrag'}</small></div></div></section>
    </div>
    <section className="weekly-challenges"><div className="section-heading"><div><p className="eyebrow">VECKANS UPPTÄCKTER</p><h2>Små utmaningar, nya kunskaper</h2></div><span className="panel-emoji">🌟</span></div><div className="weekly-challenge-list">{weeklyChallenges.map(({ challenge, progress }) => <article className={`weekly-challenge${progress.completedAt ? ' is-complete' : ''}`} key={challenge.id}><div className="weekly-challenge-heading"><strong>{challenge.title}</strong><span>{progress.progress} / {challenge.target}</span></div><p>{challenge.description}</p><span className="weekly-challenge-track"><i style={{ width: `${Math.min(100, (progress.progress / challenge.target) * 100)}%` }} /></span><small>{progress.completedAt ? `Klar! +${challenge.rewardXp} XP${challenge.rewardBadge ? ` · ${challenge.rewardBadge}` : ''}` : `Belöning: ${challenge.rewardXp} XP${challenge.rewardBadge ? ` · ${challenge.rewardBadge}` : ''}`}</small></article>)}</div></section>
    <footer className="home-footer"><Heart size={14} fill="currentColor" /> Lär med nyfikenhet, en fråga i taget.</footer>
  </div>
}