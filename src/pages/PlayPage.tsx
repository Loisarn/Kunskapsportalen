import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Star, Volume2, VolumeX, Zap } from 'lucide-react'
import type { AnswerFeedback, ChildProfile, PlaySession } from '../domain/types'
import { ConceptService } from '../services/ConceptService'
import { SessionService, type SessionQuestion } from '../services/SessionService'
import { renderFlagText } from '../features/play-session/FlagText'

function getQuestionSpeechText(question: SessionQuestion): string {
  const removeFlags = (text: string) => text.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '').trim()
  const prompt = removeFlags(question.prompt)
  const options = question.type === 'multiple-choice'
    ? (question.options ?? []).map((option, index) => `Alternativ ${String.fromCharCode(65 + index)}: ${removeFlags(option)}`)
    : question.type === 'true-false'
      ? ['Sant', 'Falskt']
      : []
  return options.length ? `${prompt} Svarsalternativen är: ${options.join('. ')}.` : prompt
}

export function PlayPage({ profile, onProfileUpdated }: { profile: ChildProfile; onProfileUpdated: () => Promise<void> }) {
  const navigate = useNavigate()
  const [conceptTitles, setConceptTitles] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<SessionQuestion[]>([])
  const [session, setSession] = useState<PlaySession>()
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<AnswerFeedback>()
  const [completed, setCompleted] = useState<PlaySession>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [],
  )
  useEffect(() => {
    let active = true
    void (async () => { try {
      const concepts = await ConceptService.getConceptsWithProgress(profile.id)
      if (!concepts.some(({ progress }) => progress.introduced)) { if (active) setLoading(false); return }
      const result = await SessionService.startDailyAdventure(profile.id)
      if (active) {
        setConceptTitles(Object.fromEntries(concepts.map(({ concept }) => [concept.id, concept.title])))
        setSession(result.session)
        setQuestions(result.questions)
        setQuestionIndex(result.session.answers.length)
        if (result.session.completedAt) {
          setCompleted(result.session)
        } else if (result.session.answers.length >= result.session.totalQuestions) {
          const finished = await SessionService.completeSession(result.session.id)
          if (active) {
            setCompleted(finished)
            await onProfileUpdated()
          }
        }
      }
    } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Något gick fel.') } finally { if (active) setLoading(false) } })()
    return () => { active = false }
  }, [profile.id, onProfileUpdated])
  const question = questions[questionIndex]
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const swedishVoice = voices.find(({ lang }) => /^sv(?:-|$)/i.test(lang))
  useEffect(() => {
    if (!speechSupported) return
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
  }, [speechSupported])
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [question?.id])
  const toggleQuestionSpeech = () => {
    if (!speechSupported || !question || !swedishVoice) return
    const speech = window.speechSynthesis
    if (isSpeaking) {
      speech.cancel()
      setIsSpeaking(false)
      return
    }
    speech.cancel()
    const utterance = new SpeechSynthesisUtterance(getQuestionSpeechText(question))
    utterance.voice = swedishVoice
    utterance.lang = swedishVoice.lang
    utterance.rate = 0.9
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    speech.speak(utterance)
    setIsSpeaking(true)
  }
  const submitAnswer = async () => {
    if (!session || !question || !answer || feedback) return
    try {
      const result = await SessionService.submitAnswer(session.id, question, answer)
      setFeedback(result)
      setSession((current) => current ? { ...current, xpEarned: current.xpEarned + result.xpEarned } : current)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Kunde inte spara svaret.') }
  }
  const finishSession = async () => {
    if (!session) return
    try {
      setCompleted(await SessionService.completeSession(session.id))
      await onProfileUpdated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunde inte avsluta äventyret.')
    }
  }
  const nextQuestion = () => {
    if (speechSupported) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setQuestionIndex((index) => index + 1)
    setAnswer('')
    setFeedback(undefined)
  }
  if (loading) return <div className="loading-state"><span className="loading-star">✦</span><p>Packar äventyrsväskan...</p></div>
  if (error) return <div className="play-lock-screen"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={17} /> Tillbaka</button><span className="lock-illustration">🌧️</span><h1>Oj, något blev tokigt</h1><p>{error}</p><button className="primary-button" onClick={() => navigate('/')}>Till startsidan <ArrowRight size={17} /></button></div>
  if (completed) return <div className="session-complete page-enter"><span className="completion-confetti">✦ ✧ ✦</span><div className="completion-medal">🏆</div><p className="eyebrow">{completed.dailyDate ? 'DAGENS ÄVENTYR KLART!' : 'ÄVENTYRET KLART!'}</p><h1>Vilken stjärna du är!</h1><p>Du svarade på {completed.totalQuestions} frågor och lärde dig massor.</p><div className="earned-xp"><Zap size={22} fill="currentColor" /> +{completed.xpEarned} XP</div>{completed.dailyDate && <p className="daily-completion-reward">+1 stjärna · Du har {profile.stars ?? 0} stjärnor. Ett nytt äventyr väntar imorgon.</p>}<div className="completion-actions"><button className="primary-button" onClick={() => navigate('/progress')}>Se mina framsteg <ArrowRight size={17} /></button><button className="secondary-button" onClick={() => navigate('/')}>Till startsidan</button></div></div>
  if (!session || !question) return <div className="play-lock-screen"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={17} /> Tillbaka</button><span className="lock-illustration">🗝️</span><p className="eyebrow">ETT LITET ÖGONBLICK</p><h1>Äventyret väntar!</h1><p>Be en vuxen öppna ditt första koncept i Föräldraläge. Sedan kan ni ge er iväg tillsammans!</p><button className="primary-button" onClick={() => navigate('/parent')}>Till Föräldraläge <ArrowRight size={17} /></button></div>
  const progressPercent = ((questionIndex + (feedback ? 1 : 0)) / questions.length) * 100
  const isFlagImageSearch = /^hitta\b.*\bflagga\b/iu.test(question.prompt)
  return <div className="play-session page-enter"><button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={17} /> Avsluta äventyret</button>
    <div className="play-topline"><div><span className="play-concept-icon">✨</span><span><small>BLANDAT ÄVENTYR</small><strong>{conceptTitles[question.conceptId] ?? 'Kunskapsäventyr'}</strong></span></div><span className="play-xp"><Zap size={17} fill="currentColor" /> {session.xpEarned} XP</span></div>
    <div className="question-progress"><div className="question-progress-track"><i style={{ width: `${progressPercent}%` }} /></div><span>Fråga {questionIndex + 1} av {questions.length}</span></div>
    <section className={`question-card${feedback ? feedback.correct ? ' answer-correct' : ' answer-wrong' : ''}`}><div className="question-decoration">{question.type === 'text' ? '✏️' : question.type === 'true-false' ? '🤔' : '🧩'}</div><p className="eyebrow">{question.type === 'text' ? 'SKRIV DITT SVAR' : question.type === 'true-false' ? 'SANT ELLER FALSKT?' : 'VÄLJ ETT SVAR'}</p><div className="question-heading-row"><h1>{renderFlagText(question.prompt)}</h1><button type="button" className={`question-speak-button${isSpeaking ? ' is-speaking' : ''}`} onClick={toggleQuestionSpeech} disabled={!speechSupported || !swedishVoice} aria-label={isSpeaking ? 'Stoppa uppläsningen' : !swedishVoice ? 'Svensk röst saknas på enheten' : 'Läs upp frågan'} aria-pressed={isSpeaking} title={isSpeaking ? 'Stoppa uppläsningen' : !swedishVoice ? 'Svensk röst saknas på enheten' : 'Läs upp frågan'}>{isSpeaking ? <VolumeX size={21} /> : <Volume2 size={21} />}</button></div>{speechSupported && !swedishVoice && <p className="question-speech-notice" role="status">Ingen svensk röst hittades på enheten. Lägg till en svensk röst i inställningarna för tal.</p>}
      <div className={`answer-area ${question.type === 'text' ? 'text-answer-area' : ''}`}>
        {question.type === 'multiple-choice' && question.options?.map((option, index) => <button key={option} className={`answer-option${answer === option ? ' selected' : ''}${isFlagImageSearch ? ' flag-only-option' : ''}${feedback && option === question.answer ? ' correct-option' : ''}`} onClick={() => !feedback && setAnswer(option)} disabled={Boolean(feedback)}>{!isFlagImageSearch && <span className="option-key">{String.fromCharCode(65 + index)}</span>}{renderFlagText(option, !/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(question.prompt), isFlagImageSearch)}{feedback && option === question.answer && <Check size={19} />}</button>)}
        {question.type === 'true-false' && ['Sant', 'Falskt'].map((option) => <button key={option} className={`answer-option true-false-option${answer === option ? ' selected' : ''}${feedback && option === question.answer ? ' correct-option' : ''}`} onClick={() => !feedback && setAnswer(option)} disabled={Boolean(feedback)}><span className="option-symbol">{option === 'Sant' ? '✓' : '×'}</span>{option}</button>)}
        {question.type === 'text' && <input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitAnswer() }} disabled={Boolean(feedback)} placeholder="Skriv här..." aria-label="Ditt svar" />}
      </div>
      {feedback && <div className={`answer-feedback ${feedback.correct ? 'feedback-good' : 'feedback-try'}`}><span>{feedback.correct ? '🎉' : '💛'}</span><div><strong>{feedback.correct ? 'Bra jobbat!' : 'Nästan rätt!'}</strong>{!feedback.correct && <small>Rätt svar är: {feedback.correctAnswer}</small>}</div>{feedback.correct && <span className="feedback-xp">+10 XP</span>}</div>}
      <button className="primary-button answer-submit" onClick={() => feedback ? questionIndex < questions.length - 1 ? nextQuestion() : void finishSession() : void submitAnswer()} disabled={!feedback && !answer}>{feedback ? questionIndex < questions.length - 1 ? <>Nästa fråga <ArrowRight size={18} /></> : <>Se resultat <Star size={18} fill="currentColor" /></> : <>Svara <ArrowRight size={18} /></>}</button>
    </section><div className="play-encouragement"><span>🦊</span><p>Du klarar det! Ta en fråga i taget.</p><span>✦</span></div>
  </div>
}