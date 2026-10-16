import { useCallback, useEffect, useState } from 'react'
import type { ChildProfile, ContentPackage } from '../domain/types'
import { ChildService } from '../services/ChildService'
import { ConceptService } from '../services/ConceptService'
import { ContentPackageService } from '../services/ContentPackageService'
import { ProfileSelection } from '../features/profile-selection/ProfileSelection'
import type { AppContextValue } from './providers/AppContext'
import { AppRoutes } from './router/AppRoutes'
import './app.css'
import './parent-controls.css'
import './mobile.css'

function Application() {
  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [packages, setPackages] = useState<ContentPackage[]>([])
  const [profile, setProfile] = useState<ChildProfile>()
  const [ready, setReady] = useState(false)
  useEffect(() => { void (async () => {
    await ContentPackageService.loadPackages()
    setPackages(await ContentPackageService.getPackages())
    await ChildService.seedProfiles()
    const seeded = await ChildService.getProfiles(); setProfiles(seeded)
    const selected = await ChildService.getSelectedProfile()
    if (selected) { await ConceptService.ensureProgress(selected.id); setProfile(selected) }
    setReady(true)
  })() }, [])
  const profileId = profile?.id
  const refreshProfile = useCallback(async () => {
    if (!profileId) return
    const updated = await ChildService.getProfile(profileId)
    if (updated) setProfile(updated)
  }, [profileId])
  const selectProfile = async (id: string) => { const selected = await ChildService.selectProfile(id); await ConceptService.ensureProgress(selected.id); setProfile(selected) }
  if (!ready) return <div className="loading-state"><span className="loading-star">✦</span><p>Öppnar äventyrsboken...</p></div>
  const activateCreatedProfile = async (created: ChildProfile) => {
    const selected = await ChildService.selectProfile(created.id)
    await ConceptService.ensureProgress(selected.id)
    setProfiles(await ChildService.getProfiles())
    setProfile(selected)
  }
  if (!profile) return <ProfileSelection profiles={profiles} packages={packages} onSelect={selectProfile} onCreated={(created) => void activateCreatedProfile(created)} />
  const context: AppContextValue = { profile, profiles, packages, onProfileChange: selectProfile, onProfileCreated: activateCreatedProfile }
  return <AppRoutes context={context} onProfileUpdated={refreshProfile} />
}

export default function AppRoot() { return <Application /> }