import { useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import type { ChildProfile, ContentPackage, PlacementMethod } from '../../domain/types'
import { ChildService } from '../../services/ChildService'
import { ChildOnboardingService, type PlacementDomain, type PlacementQuestion } from '../../services/ChildOnboardingService'

const childAvatars = ['🦊', '🐼', '🐸', '🦁', '🐙', '🐨', '🦄', '🐢']

interface ChildOnboardingWizardProps {
  packages: ContentPackage[]
  onCancel: () => void
  onCreated: (profile: ChildProfile) => void
}

function ChildOnboardingWizard({ packages, onCancel, onCreated }: ChildOnboardingWizardProps) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(childAvatars[0])
  const [readingStartLevel, setReadingStartLevel] = useState<number>()
  const domains = ChildOnboardingService.getPlacementDomains(packages, readingStartLevel)
  const [method, setMethod] = useState<PlacementMethod>()
  const [stage, setStage] = useState<'setup' | 'assessment' | 'review'>('setup')
  const [assessment, setAssessment] = useState<PlacementQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [manualLevels, setManualLevels] = useState<Record<string, number>>(() => Object.fromEntries(
    domains.flatMap((domain) => domain.paths.map((path) => [path.pathId, path.concepts[0].concept.level])),
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const begin = (selectedMethod: PlacementMethod) => {
    setError('')
    setMethod(selectedMethod)
    if (selectedMethod === 'placement') {
      const questions = ChildOnboardingService.buildAssessment(packages, readingStartLevel)
      if (!questions.length) {
        setError('Det finns inga bedömningsfrågor ännu. Välj ett annat startläge.')
        return
      }
      setAssessment(questions)
      setAnswers({})
      setQuestionIndex(0)
      setStage('assessment')
    } else {
      setStage('review')
    }
  }

  const startingConcepts = method
    ? ChildOnboardingService.getStartingConcepts(packages, method, manualLevels, assessment, answers, readingStartLevel)
    : []
  const currentQuestion = assessment[questionIndex]
  const changeManualLevel = (pathId: string, level: number) => setManualLevels((current) => ({ ...current, [pathId]: level }))
  const changeReadingStartLevel = (level: number) => {
    setReadingStartLevel(level)
    if (level < 4) setManualLevels((current) => ({ ...current, 'early-reading': level }))
  }

  const createChild = async () => {
    if (!method || !name.trim() || readingStartLevel === undefined) return
    setSaving(true)
    setError('')
    let created: ChildProfile | undefined
    try {
      created = await ChildService.createProfile(name, avatar, readingStartLevel)
      await ChildOnboardingService.initializeProfile(created.id, method, startingConcepts)
      onCreated(created)
    } catch (cause) {
      if (created) await ChildService.deleteProfile(created.id)
      setError(cause instanceof Error ? cause.message : 'Profilen kunde inte skapas. Försök igen.')
      setSaving(false)
    }
  }

  return <main className="profile-screen onboarding-screen">
    <div className="profile-brand"><span className="brand-mark">✦</span> Kunskapsportalen</div>
    <section className="profile-picker onboarding-picker">
      <button className="back-link onboarding-back" onClick={onCancel}><ArrowLeft size={17} /> Tillbaka</button>
      <div className="profile-kicker"><Sparkles size={15} /> {stage === 'assessment' ? 'HITTA DIN STARTNIVÅ' : 'ETT NYTT ÄVENTYR'}</div>
      <h1>{stage === 'assessment' ? 'Vad kan du redan?' : stage === 'review' ? 'Din äventyrskarta' : 'Vem ska börja?'}</h1>
      <p>{stage === 'assessment' ? 'Svara så gott du kan. Det här är bara för att hitta en bra start.' : stage === 'review' ? 'Här är startnivån i varje lärväg. En vuxen kan alltid öppna nya steg senare.' : 'Skapa en egen profil med framsteg som bara tillhör dig.'}</p>

      {stage === 'setup' && <>
        <label className="onboarding-field"><span>Barnets namn</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Skriv ett namn" /></label>
        <div className="avatar-picker"><span>Välj en avatar</span><div>{childAvatars.map((option) => <button key={option} type="button" className={avatar === option ? 'selected' : ''} onClick={() => setAvatar(option)} aria-label={`Välj ${option}`} aria-pressed={avatar === option}>{option}</button>)}</div></div>
        <fieldset className="reading-ability-picker"><legend>Var börjar läsningen?</legend><label><input type="radio" name="reading-level" checked={readingStartLevel === 1} onChange={() => changeReadingStartLevel(1)} /><span><strong>Bokstäver och ljud</strong><small>Öva på bokstavsformer och enkla språkljud.</small></span></label><label><input type="radio" name="reading-level" checked={readingStartLevel === 2} onChange={() => changeReadingStartLevel(2)} /><span><strong>Enkla ord · 3–4 bokstäver</strong><small>Ord som sol, mus, bil och hus.</small></span></label><label><input type="radio" name="reading-level" checked={readingStartLevel === 3} onChange={() => changeReadingStartLevel(3)} /><span><strong>Längre ord och meningar</strong><small>Ta nästa steg med korta meningar.</small></span></label><label><input type="radio" name="reading-level" checked={readingStartLevel === 4} onChange={() => changeReadingStartLevel(4)} /><span><strong>Läser självständigt</strong><small>Börja direkt med läsförståelse.</small></span></label></fieldset>
        <div className="onboarding-mode-list">
          <button disabled={!name.trim() || readingStartLevel === undefined} onClick={() => begin('beginning')}><span>🌱</span><span><strong>Börja från början</strong><small>Starta på första nivån i varje lärväg.</small></span><ArrowRight size={18} /></button>
          <button disabled={!name.trim() || readingStartLevel === undefined} onClick={() => begin('placement')}><span>🧭</span><span><strong>Gör ett nivåtest</strong><small>Få en uppskattad startnivå i varje ämne.</small></span><ArrowRight size={18} /></button>
          <button disabled={!name.trim() || readingStartLevel === undefined} onClick={() => begin('manual')}><span>🎚️</span><span><strong>Välj nivå själv</strong><small>Välj startnivå för varje lärväg.</small></span><ArrowRight size={18} /></button>
        </div>
      </>}

      {stage === 'assessment' && currentQuestion && <div className="placement-question">
        <div className="placement-meta"><span>{currentQuestion.domainTitle} · {currentQuestion.pathTitle}</span><span>{questionIndex + 1} / {assessment.length}</span></div>
        <div className="placement-track"><i style={{ width: `${((questionIndex + 1) / assessment.length) * 100}%` }} /></div>
        <h2>{currentQuestion.prompt}</h2>
        <div className="placement-options">{currentQuestion.options?.map((option) => <button key={option} className={answers[currentQuestion.key] === option ? 'selected' : ''} onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.key]: option }))}>{option}</button>)}</div>
        <button className="primary-button placement-next" disabled={!answers[currentQuestion.key]} onClick={() => {
          if (questionIndex < assessment.length - 1) setQuestionIndex((current) => current + 1)
          else setStage('review')
        }}>{questionIndex < assessment.length - 1 ? <>Nästa fråga <ArrowRight size={17} /></> : <>Se min startnivå <ArrowRight size={17} /></>}</button>
      </div>}

      {stage === 'review' && <div className="placement-review">
        {domains.map((domain: PlacementDomain) => <section key={domain.id}><h2><span>{domain.emoji}</span>{domain.title}</h2>{domain.paths.map((path) => {
          const selected = method === 'manual'
            ? path.concepts.find(({ concept }) => concept.level === manualLevels[path.pathId])
            : startingConcepts.find(({ learningPath }) => learningPath.id === path.pathId)
          return <div className="placement-path" key={path.pathId}><div><strong>{path.title}</strong>{method === 'manual' ? <label><span className="sr-only">Startnivå för {path.title}</span><select value={manualLevels[path.pathId]} onChange={(event) => changeManualLevel(path.pathId, Number(event.target.value))}>{path.concepts.map(({ concept }) => <option key={concept.id} value={concept.level}>Nivå {concept.level}</option>)}</select></label> : <small>Nivå {selected?.concept.level ?? path.concepts[0].concept.level} · {selected?.concept.title ?? path.concepts[0].concept.title}</small>}</div>{method === 'placement' && <span className="placement-estimate">Uppskattning</span>}</div>
        })}</section>)}
        {method === 'manual' && <button className="primary-button" disabled={saving} onClick={() => void createChild()}>{saving ? 'Skapar profil...' : <>Skapa profil <ArrowRight size={17} /></>}</button>}
      </div>}
      {stage === 'review' && method !== 'manual' && <button className="primary-button onboarding-create" disabled={saving} onClick={() => void createChild()}>{saving ? 'Skapar profil...' : <>Skapa profil <ArrowRight size={17} /></>}</button>}
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      {stage === 'review' && method === 'placement' && <button className="onboarding-reset" onClick={() => setStage('setup')}>Ändra startläge</button>}
    </section>
  </main>
}

export function ProfileSelection({ profiles, packages, onSelect, onCreated }: { profiles: ChildProfile[]; packages: ContentPackage[]; onSelect: (id: string) => Promise<void>; onCreated: (profile: ChildProfile) => void }) {
  const [creating, setCreating] = useState(false)
  if (creating) return <ChildOnboardingWizard packages={packages} onCancel={() => setCreating(false)} onCreated={onCreated} />
  return <main className="profile-screen">
    <div className="profile-sparkle sparkle-one">✦</div><div className="profile-sparkle sparkle-two">✳</div>
    <div className="profile-brand"><span className="brand-mark">✦</span> Kunskapsportalen</div>
    <section className="profile-picker">
      <div className="profile-kicker"><Sparkles size={15} /> DAGS FÖR ÄVENTYR</div>
      <h1>Vem ska spela idag?</h1><p>Välj din hjälte så fortsätter äventyret där du slutade.</p>
      <div className="profile-options">{profiles.map((profile, index) => <button className={`profile-option profile-option-${index}`} key={profile.id} onClick={() => void onSelect(profile.id)}>
        <span className="profile-avatar">{profile.avatar}</span><span className="profile-name">{profile.name}</span><span className="profile-level">Nivå {profile.level}</span><ArrowRight className="profile-arrow" size={20} />
      </button>)}<button className="profile-option profile-add-option" onClick={() => setCreating(true)}><span className="profile-avatar"><Plus size={28} /></span><span className="profile-name">Lägg till barn</span><span className="profile-level">Ny profil</span><ArrowRight className="profile-arrow" size={20} /></button></div>
      <div className="profile-footnote"><ShieldCheck size={16} /> Dina äventyr sparas bara här på enheten</div>
    </section>
  </main>
}

export function OnboardingPage({ packages, onCreated }: { packages: ContentPackage[]; onCreated: (profile: ChildProfile) => void }) {
  return <ChildOnboardingWizard packages={packages} onCancel={() => window.history.back()} onCreated={onCreated} />
}