import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Award, Check, ChevronDown, Compass, Home, LockKeyhole, Plus } from 'lucide-react'
import type { AppContextValue } from '../providers/AppContext'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export function AppLayout({ context }: { context: AppContextValue }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const onInstalled = () => setIsInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const navigation = [
    { to: '/', label: 'Spela', icon: Home, end: true }, { to: '/discover', label: 'Utforska', icon: Compass },
    { to: '/progress', label: 'Framsteg', icon: Award }, { to: '/parent', label: 'Föräldraläge', icon: LockKeyhole },
  ]
  const installApp = async () => { if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null) } }
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="wordmark" aria-label="Kunskapsportalen startsida"><span className="wordmark-icon">✦</span><span>kunskaps<span>portalen</span></span></NavLink>
      <nav className="desktop-nav" aria-label="Huvudmeny">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="topbar-actions">
        {installPrompt && !isInstalled && <button className="install-button" onClick={() => void installApp()}>Installera <Plus size={15} /></button>}
        <button className="profile-switch" onClick={() => setSwitcherOpen((open) => !open)} aria-expanded={switcherOpen}><span className="tiny-avatar">{context.profile.avatar}</span><span className="switch-name">{context.profile.name}</span><ChevronDown size={15} /></button>
        {switcherOpen && <div className="profile-menu">{context.profiles.map((profile) => <button key={profile.id} onClick={() => { void context.onProfileChange(profile.id); setSwitcherOpen(false) }}><span>{profile.avatar}</span>{profile.name}{profile.id === context.profile.id && <Check size={16} />}</button>)}<button onClick={() => { navigate('/onboarding'); setSwitcherOpen(false) }}><Plus size={16} /> Lägg till barn</button><button className="profile-menu-home" onClick={() => { localStorage.removeItem('knowledge-portal.selected-profile'); window.location.reload() }}><ArrowLeft size={15} /> Byt profil</button></div>}
      </div>
    </header>
    <main className={`page-content ${location.pathname === '/play' ? 'play-page-content' : ''}`}><Outlet /></main>
    <nav className="mobile-nav" aria-label="Huvudmeny">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}><Icon size={21} /><span>{label}</span></NavLink>)}</nav>
  </div>
}