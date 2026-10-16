import type { ChildProfile, ContentPackage } from '../../domain/types'

export interface AppContextValue {
  profile: ChildProfile
  profiles: ChildProfile[]
  packages: ContentPackage[]
  onProfileChange: (id: string) => Promise<void>
  onProfileCreated: (profile: ChildProfile) => Promise<void>
}