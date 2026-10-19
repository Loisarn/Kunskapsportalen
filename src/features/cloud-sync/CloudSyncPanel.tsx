import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Cloud, CloudOff, RefreshCw, ShieldCheck } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { CloudSyncService } from '../../services/CloudSyncService'

export function CloudSyncPanel({ onSynced }: { onSynced: () => Promise<void> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [createAccount, setCreateAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<string>()
  const [pendingCount, setPendingCount] = useState(0)

  const sync = useCallback(async () => {
    const result = await CloudSyncService.syncNow()
    setLastSyncedAt(result.syncedAt)
    setPendingCount(result.pendingCount)
    if (result.error && result.error !== 'offline') setError(result.error)
    else setError('')
    if (result.syncedAt) await onSynced()
    return result
  }, [onSynced])

  useEffect(() => {
    let active = true
    if (!CloudSyncService.isConfigured()) return
    void CloudSyncService.getSession().then((currentSession) => {
      if (!active) return
      setSession(currentSession)
      if (currentSession) void sync()
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Kontostatus kunde inte hämtas.')
    })
    const unsubscribe = CloudSyncService.onAuthStateChange((nextSession) => {
      setSession(nextSession)
      if (nextSession) window.setTimeout(() => { void sync() }, 0)
      else {
        setLastSyncedAt(undefined)
        setNotice('Du är utloggad. Framsteg finns kvar lokalt på enheten.')
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [sync])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (createAccount) {
        const result = await CloudSyncService.signUp(email.trim(), password)
        if (!result.session) {
          setNotice('Kontot är skapat. Bekräfta e-postadressen och logga sedan in för att synka.')
        } else {
          setSession(result.session)
          const syncResult = await sync()
          setNotice(syncResult.error ? 'Kontot är klart. Synkroniseringen behöver åtgärdas innan den kan fortsätta.' : 'Kontot är klart och framstegen synkroniseras.')
        }
      } else {
        const result = await CloudSyncService.signIn(email.trim(), password)
        setSession(result.session)
        const syncResult = await sync()
        setNotice(syncResult.error ? 'Inloggad, men synkroniseringen behöver åtgärdas innan den kan fortsätta.' : 'Inloggad och synkroniserad.')
      }
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kontot kunde inte användas.')
    } finally {
      setBusy(false)
    }
  }

  const syncOnDemand = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    const result = await sync()
    if (result.error === 'offline') setNotice('Du är offline. Ändringar sparas lokalt och synkas när du är online igen.')
    else if (result.error) setError(result.error)
    else setNotice('Framstegen är synkroniserade.')
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    try {
      await CloudSyncService.signOut()
      setSession(null)
      setNotice('Du är utloggad. Framsteg finns kvar lokalt på enheten.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Utloggningen misslyckades.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="cloud-sync-panel" aria-labelledby="cloud-sync-heading">
    <div className="cloud-sync-heading">
      <span className="cloud-sync-icon">{CloudSyncService.isConfigured() ? <Cloud size={19} /> : <CloudOff size={19} />}</span>
      <div><h2 id="cloud-sync-heading">Molnsynk</h2><p>Synka barnens framsteg mellan enheter och ominstallationer.</p></div>
      <ShieldCheck className="cloud-sync-shield" size={20} aria-label="Skyddat föräldrakonto" />
    </div>
    {!CloudSyncService.isConfigured() ? <p className="cloud-sync-message">Molnsynk är inte konfigurerad. Lägg till Supabase-uppgifterna i miljöinställningarna; appen fortsätter att spara lokalt.</p> : session ? <>
      <div className="cloud-sync-account"><span>{session.user.email}</span><span>{pendingCount ? `${pendingCount} väntar` : lastSyncedAt ? `Synkad ${new Date(lastSyncedAt).toLocaleString('sv-SE')}` : 'Kontot är anslutet'}</span></div>
      <div className="cloud-sync-actions"><button type="button" className="secondary-button" onClick={() => void syncOnDemand()} disabled={busy}><RefreshCw size={16} /> Synka nu</button><button type="button" className="cloud-sync-signout" onClick={() => void signOut()} disabled={busy}>Logga ut</button></div>
    </> : <>
      <p className="cloud-sync-message">Skapa ett föräldrakonto eller logga in. Ditt konto skyddar synkroniserade profiler och framsteg.</p>
      <form className="cloud-sync-form" onSubmit={(event) => void submit(event)}>
        <label><span>E-post</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label><span>Lösenord</span><input type="password" autoComplete={createAccount ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <div className="cloud-sync-actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Vänta...' : createAccount ? 'Skapa konto' : 'Logga in'}</button><button type="button" className="cloud-sync-signout" onClick={() => { setCreateAccount((value) => !value); setError(''); setNotice('') }}>{createAccount ? 'Har redan konto?' : 'Skapa konto'}</button></div>
      </form>
    </>}
    {notice && <p className="cloud-sync-notice" role="status">{notice}</p>}
    {error && <p className="cloud-sync-error" role="alert">{error}</p>}
  </section>
}
