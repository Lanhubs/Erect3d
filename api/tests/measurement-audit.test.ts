import{expect,test}from'bun:test'
import{guardMeasurementAudit}from'../src/workers/measurement-audit'
import{responseSchema}from'../src/modules/ai/response-schema'
import type{Candidate,Intelligence}from'../src/contracts/analysis'
const base={confidence:.9,evidence:'Source band',uncertainties:[],needsReview:true as const}
const wall:Candidate={...base,id:'cv_wall_0',kind:'wall',points:[{x:.1,y:.2},{x:.8,y:.2}]}
const edge:Candidate={...wall,id:'cv_edge_0',confidence:.45}
const proposal=(candidates:Candidate[]):Intelligence=>({coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates,warnings:[]})
test('fine measurement decisions cannot remove or redraw established geometry',()=>{
 const corrected={...wall,points:[{x:.2,y:.3},{x:.9,y:.3}]},audit=proposal([corrected])
 audit.dispositions=[{candidateId:wall.id,decision:'reject',reason:'Unrequested redraw'},
  {candidateId:edge.id,decision:'confirm',reason:'Fine partition'}]
 const safe=guardMeasurementAudit(audit,[wall,edge],proposal([wall]))
 expect(safe.candidates).toEqual([]);expect(safe.dispositions).toEqual([audit.dispositions[1]])
 expect(wall.points[0]).toEqual({x:.1,y:.2});expect(safe.warnings.length).toBeGreaterThan(0)
 const established=proposal([edge]);expect(guardMeasurementAudit(audit,[edge],established).dispositions).toEqual([])
})
test('the native audit generation grammar restricts decisions to exact measured IDs and allows ambiguity',()=>{
 const schema=responseSchema('native-measurement-audit',[edge.id]) as any
 expect(schema.properties.dispositions.items.properties.candidateId.enum).toEqual([edge.id])
 expect(schema.properties.dispositions.items.properties.decision.enum).toContain('defer')
 expect(schema.properties.candidates.items.properties).toEqual({})
 expect(schema.properties.understanding).toBeUndefined()
})
