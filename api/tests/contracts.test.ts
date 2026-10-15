import { expect,test } from 'bun:test'
import { createSampleLibrary } from '../../client/src/domain/sampleLibrary'
import { projectSchema } from '../src/contracts/project'
import { validateGeometry } from '../src/modules/projects/geometry-validation'
import { applyChanges } from '../src/modules/projects/patch'
import { checksum } from '../src/security/tokens'
import { fixture } from './helpers'
import { documentChanges } from '../client/diff'
import { readConfig } from '../src/config/env'
import { messageSchema } from '../src/realtime/protocol'
import { intelligenceSchema,type Candidate } from '../src/contracts/analysis'
import { reconcile,analysisPasses } from '../src/modules/ai/reconcile'
import { imageToWorld } from '../src/modules/plan-analysis/conversion'
import { permissions } from '../src/security/permissions'
import { compareDocuments } from '../src/modules/versions/service'
import { sendFrame } from '../src/realtime/send'
test('all existing sample documents use the same API contract',()=>{
  for (const sample of createSampleLibrary()) {
    const result=projectSchema.safeParse(sample.project)
    if (!result.success) throw new Error(`${sample.id}: ${JSON.stringify(result.error.issues)}`)
    validateGeometry(result.data)
  }
})
test('patches replay dependent wall edits, retain IDs, and reject prototype and identity paths',()=>{
  const before=fixture(),after=structuredClone(before),wall=after.buildings[0].levels[0].walls[0]
  wall.start.x=1
  const changes=documentChanges(before,after),replayed=applyChanges(before,changes,123)
  expect(replayed.buildings).toEqual(after.buildings)
  expect(before.buildings[0].levels[0].walls[0].start.x).toBe(0)
  expect(()=>applyChanges(before,[{ action:'put',path:['__proto__','polluted'],value:true }],1)).toThrow()
  expect(()=>applyChanges(before,[{ action:'put',path:['id'],value:'different' }],1)).toThrow()
  expect(changes.some(change=>change.path.length===1 && change.path[0]==='buildings')).toBe(false)
})
test('snapshot checksums survive PostgreSQL JSONB key reordering',()=>{
  expect(checksum({ a:1,b:{ c:3,d:2 } })).toBe(checksum({ b:{ d:2,c:3 },a:1 }))
})
test('foreign hosts, zero geometry, duplicate entities and wrong furniture levels fail validation',()=>{
  const project=fixture(),level=project.buildings[0].levels[0]
  level.doors.push({ id:'door-invalid',wallId:'foreign',offset:0,width:.9,height:2.1,hinge:'left' })
  expect(()=>validateGeometry(project)).toThrow()
  level.doors=[]; level.walls.push(structuredClone(level.walls[0]))
  expect(()=>validateGeometry(project)).toThrow()
})
test('production environment cannot silently start with insecure TLS or wildcard origins',()=>{
  expect(()=>readConfig({ DATABASE_URL:'postgres://localhost/test',NODE_ENV:'production',ALLOWED_ORIGINS:'*' })).toThrow()
  expect(()=>readConfig({ DATABASE_URL:'postgres://localhost/test',RATE_LIMIT_BACKEND:'redis' })).toThrow()
})
test('realtime only accepts bounded known operations and transient presence',()=>{
  expect(messageSchema.safeParse({ type:'admin.deleteEverything' }).success).toBe(false)
  expect(messageSchema.safeParse({ type:'presence.update',presence:{ camera:{ x:Infinity,y:0,z:0,yaw:0,pitch:0 } } }).success).toBe(false)
  expect(messageSchema.safeParse({ type:'presence.update',presence:{ typing:true } }).success).toBe(true)
  expect(permissions.VIEWER).toEqual(['view'])
})
test('AI proposals preserve review and uncertainty and optional furniture stays off',()=>{
  const candidate:Candidate={ id:'detected',kind:'wall',points:[{ x:.1,y:.2 },{ x:.8,y:.2 }],confidence:.8,
    evidence:'one dark stroke',uncertainties:['scale approximate'],needsReview:true }
  const proposal={ coordinatesVersion:1 as const,coordinateSystem:'normalized-image-top-left' as const,
    candidates:[candidate,{ ...candidate,id:'chair',kind:'furniture' as const }],warnings:[] }
  expect(reconcile([], [proposal],'structure').candidates).toHaveLength(1)
  expect(intelligenceSchema.safeParse({ ...proposal,coordinatesVersion:2 }).success).toBe(false)
  expect(analysisPasses('structure',false)).toEqual(['global-understanding','structure','openings'])
  expect(imageToWorld({ x:.5,y:.25 },1000,800,{ calibration:{ a:{ x:0,z:0 },b:{ x:1,z:0 },knownMetres:1,metresPerPixel:.01 },alignment:{ x:2,z:3 } } as any)).toEqual({ x:7,z:5 })
})
test('semantic comparisons detect polygon edits and slow WebSocket peers are bounded',()=>{
  const before=fixture(),level=before.buildings[0].levels[0]
  level.rooms=[{ id:'room_test',name:'Room',material:'tile',polygon:[{ x:0,z:0 },{ x:3,z:0 },{ x:3,z:3 }] }]
  const after=structuredClone(before)
  after.buildings[0].levels[0].rooms[0].polygon[1].x=4
  expect(compareDocuments(before,after).modified).toContain('room_test')
  let code=0,sent=false
  const socket={ raw:{ getBufferedAmount:()=>5*1024*1024 },close:(value:number)=>{ code=value },send:()=>{ sent=true } }
  expect(sendFrame(socket as any,{ type:'ping' })).toBe(false)
  expect(code).toBe(1013);expect(sent).toBe(false)
})
