import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import type { ChildProfile } from '../../domain/types'
import { OnboardingPage } from '../../features/profile-selection/ProfileSelection'
import { DiscoverPage } from '../../pages/DiscoverPage'
import { HomePage } from '../../pages/HomePage'
import { ParentPage } from '../../pages/ParentPage'
import { PlayPage } from '../../pages/PlayPage'
import { ProgressPage } from '../../pages/ProgressPage'
import type { AppContextValue } from '../providers/AppContext'
import { AppLayout } from './AppLayout'

function OnboardingRoute({ context }: { context: AppContextValue }) {
  const navigate = useNavigate()
  return <OnboardingPage packages={context.packages} onCreated={(created) => {
    void context.onProfileCreated(created).then(() => navigate('/'))
  }} />
}

export function AppRoutes({ context, onProfileUpdated }: { context: AppContextValue; onProfileUpdated: () => Promise<void> }) {
  const profile: ChildProfile = context.profile
  return <BrowserRouter><Routes><Route element={<AppLayout context={context} />}>
    <Route path="/" element={<HomePage profile={profile} onProfileUpdated={onProfileUpdated} />} />
    <Route path="/discover" element={<DiscoverPage profile={profile} onProfileUpdated={onProfileUpdated} />} />
    <Route path="/progress" element={<ProgressPage profile={profile} />} />
    <Route path="/play" element={<PlayPage profile={profile} onProfileUpdated={onProfileUpdated} />} />
    <Route path="/parent" element={<ParentPage profile={profile} onProfileUpdated={onProfileUpdated} />} />
    <Route path="/onboarding" element={<OnboardingRoute context={context} />} />
    <Route path="*" element={<HomePage profile={profile} onProfileUpdated={onProfileUpdated} />} />
  </Route></Routes></BrowserRouter>
}