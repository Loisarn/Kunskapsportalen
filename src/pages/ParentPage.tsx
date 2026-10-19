import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, LockKeyhole, Minus, Plus, ShieldCheck, Upload } from 'lucide-react'
import '../app/subject-groups.css'
import type { ChildProfile } from '../domain/types'
import { BackupService } from '../services/BackupService'
import { ChallengeService, type WeeklyChallengeEntry } from '../services/ChallengeService'
import { LearningPathService } from '../services/LearningPathService'
import { ParentService } from '../services/ParentService'
import { CloudSyncPanel } from '../features/cloud-sync/CloudSyncPanel'

export function ParentPage({ profile, onProfileUpdated }: { profile: ChildProfile; onProfileUpdated: () => Promise<void> }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof LearningPathService.getDashboard>>>()
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallengeEntry[]>([])
  const [showAllWeeklyChallenges, setShowAllWeeklyChallenges] = useState(false)
  const [notice, setNotice] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [backupError, setBackupError] = useState('')
  const backupFileInput = useRef<HTMLInputElement>(null)
  const concepts = dashboard?.concepts ?? []
  const conceptsBySubject = new Map<string, typeof concepts>()
  for (const entry of concepts) {
    const subjectId = entry.contentPackage.subject.id
    const subjectConcepts = conceptsBySubject.get(subjectId) ?? []
    subjectConcepts.push(entry)
    conceptsBySubject.set(subjectId, subjectConcepts)
  }
  const recommendedConceptIds = new Set((dashboard?.recommendedConcepts ?? []).map(({ concept }) => concept.id))
  const refreshDashboard = async () => {
    const [nextDashboard, nextChallenges] = await Promise.all([
      LearningPathService.getDashboard(profile.id),
      ChallengeService.getWeeklyChallenges(profile.id),
    ])
    setDashboard(nextDashboard)
    setWeeklyChallenges(nextChallenges)
  }
  const refreshAfterSync = async () => {
    await onProfileUpdated()
    await refreshDashboard()
  }
  useEffect(() => {
    if (!authenticated) return
    let isCurrent = true
    void Promise.all([
      LearningPathService.getDashboard(profile.id),
      ChallengeService.getWeeklyChallenges(profile.id),
    ]).then(([nextDashboard, nextChallenges]) => {
      if (!isCurrent) return
      setDashboard(nextDashboard)
      setWeeklyChallenges(nextChallenges)
    })
    return () => { isCurrent = false }
  }, [authenticated, profile.id])
  const verifyPin = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (await ParentService.verifyPin(pin)) { setAuthenticated(true); setPinError('') } else { setPinError('Koden stämde inte. Försök igen.'); setPin('') } }
  const introduce = async (conceptId: string, title: string) => { await ParentService.introduceConcept(profile.id, conceptId); await refreshDashboard(); setNotice(`${title} är nu öppet för ${profile.name}.`); window.setTimeout(() => setNotice(''), 3500) }
  const withdraw = async (conceptId: string, title: string) => { await ParentService.withdrawConcept(profile.id, conceptId); await refreshDashboard(); setNotice(`${title} är borttaget från ${profile.name}s lärväg. Tidigare svar och framsteg finns kvar.`); window.setTimeout(() => setNotice(''), 3500) }
  const setCompleted = async (conceptId: string, title: string, completed: boolean) => { await ParentService.setConceptCompleted(profile.id, conceptId, completed); await refreshDashboard(); setNotice(`${title} ${completed ? 'markerad som avklarad' : 'markerad som ej avklarad'}.`); window.setTimeout(() => setNotice(''), 3500) }
  const downloadBackup = async () => {
    try {
      const contents = await BackupService.exportData()
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `kunskapsportalen-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBackupError('')
      setBackupStatus('Säkerhetskopian har laddats ned. Förvara filen säkert.')
    } catch {
      setBackupError('Säkerhetskopian kunde inte skapas. Försök igen.')
    }
  }
  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !window.confirm(`Återställ ${file.name}? Detta ersätter profiler och framsteg på den här enheten.`)) return
    try {
      await BackupService.restoreData(await file.text())
      window.alert('Säkerhetskopian har återställts.')
      window.location.reload()
    } catch (cause) {
      setBackupStatus('')
      setBackupError(cause instanceof Error ? cause.message : 'Säkerhetskopian kunde inte återställas.')
    }
  }
  if (!authenticated) return <div className="parent-gate page-enter"><button className="back-link" onClick={() => window.history.back()}><ArrowLeft size={17} /> Tillbaka</button><section className="pin-card"><div className="pin-icon"><LockKeyhole size={26} /></div><p className="eyebrow">FÖR VUXNA</p><h1>Föräldraläge</h1><p>Här kan du följa barnets resa och öppna nya äventyr.</p><form onSubmit={(event) => void verifyPin(event)}><label htmlFor="parent-pin">Ange din fyrsiffriga kod</label><input id="parent-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" autoComplete="current-password" /><button className="primary-button" type="submit" disabled={pin.length !== 4}>Lås upp <ArrowRight size={17} /></button>{pinError && <span className="pin-error">{pinError}</span>}</form><div className="pin-footnote"><ShieldCheck size={16} /> </div></section></div>
  return <div className="parent-page page-enter"><div className="parent-heading"><div><p className="eyebrow">VUXENZON</p><h1>Hej, vuxen! 👋</h1><p className="page-subtitle">Hjälp {profile.name} att hitta nästa spännande sak att lära sig.</p></div><span className="parent-shield"><ShieldCheck size={24} /></span></div>
    <section className="parent-overview"><div className="parent-child-avatar">{profile.avatar}</div><div className="parent-child-info"><span>PROFIL</span><strong>{profile.name}</strong><small>Belöningsnivå {profile.level} · {profile.xp} XP · {profile.streakDays} dagar i rad</small></div><div className="parent-overview-decoration">🌱</div></section>
    <section className="parent-backup-tools" aria-labelledby="parent-backup-heading"><div><h2 id="parent-backup-heading">Säkerhetskopia</h2><p>Framsteg sparas på den här enheten. Hämta en säkerhetskopia före ominstallation eller om appens adress ändras.</p></div><div className="parent-backup-actions"><button className="secondary-button" type="button" onClick={() => void downloadBackup()}><Download size={16} /> Hämta säkerhetskopia</button><button className="secondary-button" type="button" onClick={() => backupFileInput.current?.click()}><Upload size={16} /> Återställ från fil</button><input ref={backupFileInput} className="parent-backup-file" type="file" accept="application/json,.json" onChange={(event) => void restoreBackup(event)} /></div>{backupStatus && <p className="parent-backup-status" role="status">{backupStatus}</p>}{backupError && <p className="parent-backup-error" role="alert">{backupError}</p>}</section>
    <CloudSyncPanel onSynced={refreshAfterSync} />
    <section className="parent-recommendations"><div className="section-heading"><div><p className="eyebrow">NÄSTA STEG</p><h2>Rekommenderade koncept</h2></div><span className="panel-emoji">🧭</span></div>
      {dashboard?.recommendedConcepts.length ? <div className="recommended-concept-list">{dashboard.recommendedConcepts.map(({ concept, contentPackage }) => <article className="recommended-concept" key={concept.id}><span className="recommended-emoji">{concept.emoji}</span><div><strong>{concept.title}</strong><small>{contentPackage.learningPath.title} · Nivå {concept.level}</small></div><button className="introduce-button" onClick={() => void introduce(concept.id, concept.title)}><Plus size={16} /> Introducera koncept</button></article>)}</div> : <p className="recommendation-empty">Inga nya koncept är redo ännu. Fortsätt öva och utforska upptäckterna.</p>}
    </section>
    <div className="section-heading parent-concepts-heading"><div><p className="eyebrow">LÄRANDETS BYGGSTENAR</p><h2>Koncept</h2></div><span className="subject-chip">{concepts.length} koncept</span></div>
    <div className="parent-subject-list">{[...conceptsBySubject].map(([subjectId, subjectConcepts]) => <details className="parent-subject-group" key={subjectId}>
      <summary className="parent-subject-summary"><strong>{subjectConcepts[0].contentPackage.subject.name}</strong><span>{subjectConcepts.length} koncept</span><ChevronDown size={18} /></summary>
      <div className="parent-subject-concepts">{subjectConcepts.map(({ concept, progress, contentPackage }) => { const isRecommended = recommendedConceptIds.has(concept.id); const isCompleted = Boolean(progress.parentCompleted); const status = isCompleted ? 'Avklarad av vuxen' : progress.introduced ? 'Öppet' : isRecommended ? 'Rekommenderas' : 'Tillgänglig'; const statusClass = isCompleted ? 'is-completed' : progress.introduced ? 'is-introduced' : isRecommended ? 'is-recommended' : 'is-available'; return <article className="parent-concept" key={concept.id}><span className="parent-concept-emoji">{concept.emoji}</span><div className="parent-concept-main"><div className="parent-concept-title"><div><strong>{concept.title}</strong><small>Nivå {concept.level} · {contentPackage.subject.name} · {contentPackage.questions.length} frågor · {contentPackage.discoveries.length} upptäckter</small></div><span className={`concept-status ${statusClass}`}>{status}</span></div><p>{contentPackage.lesson.content}</p><div className="parent-mastery"><span>Bemästring</span><span className="mastery-track"><i style={{ width: `${progress.mastery}%` }} /></span><strong>{progress.mastery}%</strong></div></div><div className="parent-concept-actions"><button className={`introduce-button${progress.introduced ? ' introduced' : ''}`} onClick={() => progress.introduced ? void withdraw(concept.id, concept.title) : void introduce(concept.id, concept.title)}>{progress.introduced ? <><Minus size={16} /> Ta bort introduktion</> : <><Plus size={16} /> Introducera koncept</>}</button><button className={`completion-button${isCompleted ? ' is-complete' : ''}`} aria-pressed={isCompleted} onClick={() => void setCompleted(concept.id, concept.title, !isCompleted)}><Check size={16} />{isCompleted ? 'Avklarad' : 'Markera avklarad'}</button></div></article> })}</div>
    </details>)}</div>
    <section className="parent-learning-paths"><div className="section-heading"><div><p className="eyebrow">EN RESA I FLERA STEG</p><h2>Lärvägar</h2></div><span className="subject-chip">{dashboard?.learningPaths.length ?? 0} lärvägar</span></div>
        <section className="parent-discovery-progress"><div className="section-heading"><div><p className="eyebrow">NYFIKENHET OCH FAKTA</p><h2>Upptäckter</h2></div><span className="panel-emoji">🔭</span></div><div className="parent-discovery-subject-list">{[...conceptsBySubject].map(([subjectId, subjectConcepts]) => {
          const completedCount = subjectConcepts.reduce((total, entry) => total + (entry.progress.completedDiscoveries?.length ?? 0), 0)
          const discoveryCount = subjectConcepts.reduce((total, entry) => total + entry.contentPackage.discoveries.length, 0)
          return <details className="parent-discovery-subject" key={subjectId}><summary className="parent-discovery-subject-summary"><strong>{subjectConcepts[0].contentPackage.subject.name}</strong><span>{completedCount} av {discoveryCount} upptäckter</span><ChevronDown size={17} /></summary><div className="parent-discovery-grid">{subjectConcepts.map(({ concept, progress, contentPackage }) => <article className="parent-discovery-item" key={concept.id}><span>{concept.emoji}</span><div><strong>{concept.title}</strong><small>{progress.completedDiscoveries?.length ?? 0} av {contentPackage.discoveries.length} upptäckter</small><span className="weekly-challenge-track"><i style={{ width: `${contentPackage.discoveries.length ? ((progress.completedDiscoveries?.length ?? 0) / contentPackage.discoveries.length) * 100 : 0}%` }} /></span></div></article>)}</div></details>
        })}</div></section>
        <details className="parent-challenge-progress" open><summary className="section-heading weekly-challenge-section-summary"><div><p className="eyebrow">VECKANS MÅL</p><h2>Utmaningar</h2></div><span className="weekly-challenge-section-toggle"><span className="panel-emoji">🌟</span><ChevronDown size={17} /></span></summary><div className="weekly-challenge-list" id="weekly-challenge-list">{(showAllWeeklyChallenges ? weeklyChallenges : weeklyChallenges.slice(0, 3)).map(({ challenge, progress }) => <article className={`weekly-challenge${progress.completedAt ? ' is-complete' : ''}`} key={challenge.id}><div className="weekly-challenge-heading"><strong>{challenge.title}</strong><span>{progress.progress} / {challenge.target}</span></div><p>{challenge.description}</p><span className="weekly-challenge-track"><i style={{ width: `${Math.min(100, (progress.progress / challenge.target) * 100)}%` }} /></span><small>{progress.completedAt ? `Klar · ${challenge.rewardXp} XP${challenge.rewardBadge ? ` · ${challenge.rewardBadge}` : ''}` : `Belöning: ${challenge.rewardXp} XP`}</small></article>)}</div>{weeklyChallenges.length > 3 && <button className="weekly-challenge-toggle" type="button" aria-expanded={showAllWeeklyChallenges} aria-controls="weekly-challenge-list" onClick={() => setShowAllWeeklyChallenges((isShowing) => !isShowing)}>{showAllWeeklyChallenges ? 'Visa färre' : `Visa alla ${weeklyChallenges.length} utmaningar`}<ChevronDown size={15} /></button>}</details>
      {dashboard?.learningPaths.map(({ learningPath, concepts: pathConcepts, averageMastery, masteredConcepts, progress }) => <article className="learning-path-card" key={learningPath.id}><header><div><strong>{learningPath.title}</strong><p>{learningPath.description}</p><p className="path-level-summary">Start nivå {progress.startingLevel} · Nu nivå {progress.currentLevel}</p></div><span>{masteredConcepts}/{pathConcepts.length} klara</span></header><div className="path-mastery-track"><i style={{ width: `${averageMastery}%` }} /></div><details className="path-level-disclosure"><summary className="path-level-disclosure-summary"><span className="path-level-disclosure-label"><span className="path-level-label-closed">Visa nivåer</span><span className="path-level-label-open">Dölj nivåer</span></span><span>{pathConcepts.length} nivåer</span><ChevronDown size={15} /></summary><div className="path-level-list">{pathConcepts.map(({ concept, progress: conceptProgress }) => { const isRecommended = recommendedConceptIds.has(concept.id); const isCompleted = Boolean(conceptProgress.parentCompleted); const status = isCompleted ? 'Avklarad av vuxen' : conceptProgress.introduced ? 'Introducerad' : isRecommended ? 'Rekommenderas' : 'Tillgänglig'; const statusClass = isCompleted ? 'is-completed' : conceptProgress.introduced ? 'is-introduced' : isRecommended ? 'is-recommended' : 'is-available'; return <div className="path-level-row" key={concept.id}><span className="path-level-number">NIVÅ {concept.level}</span><strong>{concept.title}</strong><span className={`path-level-status ${statusClass}`}>{status} · {conceptProgress.mastery}%</span></div> })}</div></details></article>)}
    </section>
    {notice && <div className="toast-notice"><Check size={17} /> {notice}</div>}<div className="parent-note"><span>💡</span><p><strong>Visste du?</strong> Nya koncept blir tillgängliga för barnet först när du introducerar dem här.</p></div>
  </div>
}