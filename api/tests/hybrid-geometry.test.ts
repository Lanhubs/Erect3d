import { expect, test } from 'bun:test'
import sharp from 'sharp'
import type { Candidate, Intelligence } from '../src/contracts/analysis'
import { reconcile } from '../src/modules/ai/reconcile'
import { checkCandidate } from '../src/modules/ai/candidateChecks'
import { imageToWorld } from '../src/modules/plan-analysis/conversion'
import { prepareAiImage } from '../src/workers/ai-image'
const wall: Candidate = { id: 'wall_a', kind: 'wall', points: [{ x: .1, y: .2 }, { x: .8, y: .2 }],
  confidence: .95, evidence: 'Dark band', uncertainties: [], needsReview: true }
const proposal = (candidates: Candidate[]): Intelligence => ({ coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left', candidates, warnings: [] })
test('duplicate host walls reconcile without losing their hosted doors; separate parallel walls survive', () => {
  const door: Candidate = { ...wall, id: 'door_a', kind: 'door', wallId: 'wall_b',
    points: [{ x: .3, y: .2 }, { x: .4, y: .2 }] }
  const result = reconcile([wall], [proposal([{ ...wall, id: 'wall_b' }, door,
    { ...wall, id: 'parallel', points: wall.points.map(point => ({ ...point, y: .22 })) }])], 'structure')
  expect(result.candidates.filter(candidate => candidate.kind === 'wall')).toHaveLength(2)
  expect(result.candidates.find(candidate => candidate.id === door.id)?.wallId).toBe(wall.id)
})
test('physically inconsistent candidates cannot keep high confidence', () => {
  const result = checkCandidate({ ...wall, thickness: .09 }, { width: 1000, height: 800, metresPerPixel: .1 })
  expect(result.confidence).toBeLessThanOrEqual(.35)
  expect(result.uncertainties.join()).toContain('thickness')
  const arc = checkCandidate({ ...wall, curve: { center: { x: .5, y: .5 }, radius: .2, startAngle: 0, endAngle: 1 } },
    { width: 1000, height: 800, metresPerPixel: .01 })
  expect(arc.confidence).toBeLessThanOrEqual(.35)
})
test('fine edges inside a thick wall body share its host while parallel walls with an air gap stay separate',()=>{
 const body={...wall,thickness:.006},edge={...wall,id:'edge',thickness:.001,points:wall.points.map(point=>({...point,y:point.y+.002}))}
 const separated={...edge,id:'separate',points:edge.points.map(point=>({...point,y:point.y+.01}))}
 const door:Candidate={...edge,id:'door',kind:'door',wallId:'edge',points:[{x:.3,y:.202},{x:.4,y:.202}]}
 const result=reconcile([body],[proposal([edge,separated,door])],'structure',{width:1000,height:1000,metresPerPixel:.01})
 expect(result.candidates.filter(item=>item.kind==='wall')).toHaveLength(2)
 expect(result.candidates.find(item=>item.id==='door')?.wallId).toBe(body.id)
})
test('calibration origin and level alignment match the existing editor coordinates', () => {
  expect(imageToWorld({ x: .5, y: .25 }, 1000, 800, { calibration: { a: { x: 100, z: 50 },
    b: { x: 200, z: 50 }, knownMetres: 1, metresPerPixel: .01 }, alignment: { x: 2, z: 3 } } as any)).toEqual({ x: 6, z: 4.5 })
})
test('regional analysis supplies an actual bounded crop rather than resizing the entire image again', async () => {
  const bytes = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#fff' } }).png().toBuffer()
  const result = await prepareAiImage(bytes, { x: .25, y: .25, width: .5, height: .5 })
  const metadata = await sharp(result.bytes).metadata()
  expect(metadata.width).toBe(400); expect(metadata.height).toBe(200)
})
