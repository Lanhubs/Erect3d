import type { Project } from './types'
import { houseSample, villaSample, apartmentSample } from './residentialSamples'
import { officeSample, mallSample, publicBuildingSample } from './civicSamples'
import { furnishedHouseSample } from './furnishedSample'
import { asterionTowerSample } from './asterionTowerSample'

export type SampleCategory = 'Residential' | 'Commercial' | 'Public'
export type ArchitecturalSample = { id: string; category: SampleCategory; title: string; description: string; project: Project;
  previewImage?: string; preferredView?: 'plan' | 'split' | 'model' }

export function createSampleLibrary(): ArchitecturalSample[] {
  const house = houseSample(), villa = villaSample(), apartment = apartmentSample(), office = officeSample(),
    mall = mallSample(), publicBuilding = publicBuildingSample()
  return [
    { id: 'furnished-house', category: 'Residential', title: 'Maple House · furnished walkthrough', description: 'Furnished two-storey home with a connected stair hall, kitchen and bathroom fixtures, editable furniture and continuous first-person exploration.', project: furnishedHouseSample() },
    { id: 'house', category: 'Residential', title: 'Willow Court House', description: 'Single-storey family home with an entrance porch, timber screen, connected rooms and a fenced garden.', project: house },
    { id: 'villa', category: 'Residential', title: 'Juniper Ridge Villa', description: 'Split-wing villa with curved gallery, garden pergola, upper terrace and varied roof sections.', project: villa },
    { id: 'apartment', category: 'Residential', title: 'Meridian Apartments', description: 'Three residential levels with shared stairs, cantilevered balconies and editable balustrades.', project: apartment },
    { id: 'office', category: 'Commercial', title: 'Northline Studio Offices', description: 'Two commercial floors with open work areas, meeting suite, reception and a structural column grid.', project: office },
    { id: 'asterion-tower', category: 'Commercial', title: 'Asterion Tower · 48-storey skyscraper', description: 'A furnished office skyscraper with a three-storey podium, linked office floors, a sky lounge, guarded terraces and a screened metal crown. Edit a template or detach individual floors.', project: asterionTowerSample(), previewImage: '/samples/asterion-tower.webp', preferredView: 'model' },
    { id: 'mall', category: 'Commercial', title: 'Central Walk Mall', description: 'Two retail galleries arranged around a large atrium void with independently modeled roof sections.', project: mall },
    { id: 'public', category: 'Public', title: 'Harbor Civic Forum', description: 'Irregular public complex with curved hall wall, community rooms, exhibition floor and accessible ramp.', project: publicBuilding },
  ]
}
