import { database } from '../data/database'
import { ConceptService } from './ConceptService'

export const ParentService = {
  async verifyPin(pin: string): Promise<boolean> {
    const settings = await database.settings.get('parent')
    if (!settings) {
      await database.settings.add({ id: 'parent', pin: '4321' })
      return pin === '4321'
    }
    return settings.pin === pin
  },

  async introduceConcept(profileId: string, conceptId: string): Promise<void> {
    await ConceptService.introduce(profileId, conceptId)
  },

  async setConceptCompleted(profileId: string, conceptId: string, completed: boolean): Promise<void> {
    await ConceptService.setParentCompletion(profileId, conceptId, completed)
  },

  async withdrawConcept(profileId: string, conceptId: string): Promise<void> {
    await ConceptService.withdrawIntroduction(profileId, conceptId)
  },
}