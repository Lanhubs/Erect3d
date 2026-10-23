import { houseSample, villaSample, apartmentSample } from './residentialSamples'
import { officeSample, mallSample, publicBuildingSample } from './civicSamples'
import { furnishedHouseSample } from './furnishedSample'
import { towerValidationSample } from './towerValidationSample'
import { makeLevel, makeProject, p, room, linkStair } from './sampleHelpers'
import { defaultRoof, uid, type Project } from './types'
import type { ArticulationSystem } from './buildingSystems'
import { duplicateLevel } from './levels'
// Authored regression drawings, not claimed to be Gemini reconstructions.
export function architecturalQualitySample() {
  const outline = [p(0, 0), p(14, 0), p(14, 10), p(0, 10)]
  const ground = makeLevel(
    'Ground floor',
    0,
    outline,
    [
      room('Living / dining', [p(0, 0), p(9, 0), p(9, 6), p(0, 6)], 'oak', 'living'),
      room('Kitchen', [p(9, 0), p(14, 0), p(14, 6), p(9, 6)], 'porcelain-tile', 'kitchen'),
      room('Bedroom', [p(0, 6), p(7, 6), p(7, 10), p(0, 10)], 'oak', 'bedroom'),
      room('Study', [p(7, 6), p(14, 6), p(14, 10), p(7, 10)], 'oak', 'study'),
    ],
    [
      [p(9, 0), p(9, 6)],
      [p(0, 6), p(14, 6)],
      [p(7, 6), p(7, 10)],
    ],
  )
  ground.doors = [
    {
      id: uid('door'),
      wallId: ground.walls[0].id,
      offset: 6.2,
      width: 1.6,
      height: 2.4,
      hinge: 'left',
      style: 'double',
      leafStyle: 'glazed',
    },
    ...ground.walls.slice(4).map((w) => ({
      id: uid('door'),
      wallId: w.id,
      offset: 1.2,
      width: 0.9,
      height: 2.2,
      hinge: 'left' as const,
      style: 'panel' as const,
    })),
  ]
  ground.windows = [1.2, 10.4].map((offset) => ({
    id: uid('window'),
    wallId: ground.walls[0].id,
    offset,
    width: 2.4,
    height: 1.75,
    sill: 0.65,
    type: 'fixed',
    frame: 'aluminium',
    mullions: 2,
    transoms: 0,
    frameWidth: 0.045,
    frameDepth: 0.085,
    sillProjection: 0.09,
  }))
  for (const wall of ground.walls.slice(1, 4))
    ground.windows.push({
      id: uid('window'),
      wallId: wall.id,
      offset: 2,
      width: 2.4,
      height: 1.75,
      sill: 0.65,
      type: 'fixed',
      frame: 'aluminium',
      mullions: 2,
      transoms: 0,
      frameWidth: 0.045,
      frameDepth: 0.085,
      sillProjection: 0.09,
    })
  const project = makeProject('Architectural construction · authored house fixture', 'House', [ground], {
    ...defaultRoof,
    shape: 'gable',
    pitch: 24,
    color: '#525e64',
    overhang: 0.5,
  })
  const base: ArticulationSystem = {
    id: uid('architecture'),
    name: 'Entrance canopy',
    kind: 'articulation',
    levelId: ground.id,
    origin: 'user-selected',
    evidence: 'Authored validation drawing',
    elevation: 0,
    color: '#d4d1c7',
    profile: 'canopy',
    material: 'concrete',
    path: [p(5.4, 0), p(8.6, 0)],
    footprint: [p(5.4, 0), p(8.6, 0), p(8.6, -1.8), p(5.4, -1.8)],
    height: 2.65,
    depth: 1.8,
    thickness: 0.16,
    spacing: 1,
    side: 'right',
  }
  project.buildings[0].systems = {
    version: 1,
    typology: 'house',
    systems: [
      base,
      ...ground.walls.slice(0, 4).flatMap((w) =>
        ['cornice', 'plinth'].map((profile) => ({
          ...base,
          id: uid('architecture'),
          name: profile,
          profile: profile as 'cornice' | 'plinth',
          footprint: undefined,
          path: [w.start, w.end],
          elevation: profile === 'cornice' ? 2.95 : 0,
          height: profile === 'cornice' ? 0.15 : 0.25,
          depth: 0.14,
          thickness: 0.08,
          material: 'stone' as const,
          color: profile === 'cornice' ? '#d4d1c7' : '#a5a69e',
        })),
      ),
    ],
  }
  return project
}
function mixedUse() {
  const outline = [p(0, 0), p(20, 0), p(20, 16), p(0, 16)],
    upperOutline = [p(2, 2), p(18, 2), p(18, 14), p(2, 14)]
  const ground = makeLevel(
    'Retail and shared circulation',
    0,
    outline,
    [
      room('Retail', [p(0, 0), p(14, 0), p(14, 16), p(0, 16)], 'tile', 'retail'),
      room('Shared stair hall', [p(14, 0), p(20, 0), p(20, 16), p(14, 16)], 'concrete', 'circulation'),
    ],
    [[p(14, 0), p(14, 16)]],
  )
  const upper = makeLevel('Residential floor with setback', 3.6, upperOutline, [
    room('Residence', upperOutline, 'oak', 'living'),
  ])
  linkStair(ground, upper, p(15, 3), 0, 'U')
  return makeProject('Mixed-use setback · authored fixture', 'Mixed-use building', [ground, upper], {
    ...defaultRoof,
    shape: 'terrace',
    pitch: 0,
    material: 'membrane',
  })
}
export function spiralValidationSample() {
  const project = architecturalQualitySample(),
    building = project.buildings[0],
    ground = building.levels[0]
  ground.autoRoof = false
  const upper = duplicateLevel(ground, 'Level 01', 3.2),
    top = duplicateLevel(ground, 'Level 02', 6.4)
  upper.autoRoof = false
  top.autoRoof = true
  building.levels.push(upper, top)
  building.systems!.systems.push({
    id: uid('architecture'),
    name: 'Authored three-floor spiral',
    kind: 'spiral-stair',
    levelId: ground.id,
    origin: 'user-selected',
    evidence: 'Authored circulation regression fixture',
    elevation: 0,
    color: '#67757b',
    center: p(6, 4),
    radius: 1.5,
    width: 1.15,
    height: 6.4,
    riserHeight: 0.17,
    turnHeight: 3.2,
    rotation: 0,
    clockwise: true,
    material: 'metal',
  })
  building.walkViewpoints = [
    {
      id: 'spiral-entry',
      name: 'Spiral stair entry',
      levelId: ground.id,
      point: p(8.4, 4),
      foot: 0,
      yaw: Math.PI / 2,
      pitch: 0.05,
    },
  ]
  project.name = 'Spiral circulation · authored three-floor fixture'
  return project
}
export function buildingValidationSamples(): { id: string; title: string; project: Project }[] {
  return [
    {
      id: 'quality-house',
      title: 'Authored house · opening and facade construction',
      project: architecturalQualitySample(),
    },
    {
      id: 'quality-spiral',
      title: 'Authored three-floor spiral circulation',
      project: spiralValidationSample(),
    },
    { id: 'qa-bungalow', title: 'Bungalow regression', project: houseSample() },
    { id: 'qa-duplex', title: 'Duplex regression', project: furnishedHouseSample() },
    { id: 'qa-villa', title: 'Villa regression', project: villaSample() },
    { id: 'qa-apartment', title: 'Apartment regression', project: apartmentSample() },
    { id: 'qa-office', title: 'Office regression', project: officeSample() },
    { id: 'qa-office-tower', title: 'Office tower regression', project: towerValidationSample(32) },
    { id: 'qa-mixed-use', title: 'Mixed-use regression', project: mixedUse() },
    { id: 'qa-mall', title: 'Mall regression', project: mallSample() },
    { id: 'qa-public', title: 'Public building regression', project: publicBuildingSample() },
    { id: 'qa-irregular', title: 'Irregular / curved regression', project: villaSample() },
    { id: 'qa-high-rise', title: '256-storey allocation regression', project: towerValidationSample(256) },
  ]
}
