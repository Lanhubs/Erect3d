import { afterAll,beforeAll,expect,test } from 'bun:test'
import { account,harness,request,type Account } from './helpers'
import { projectSchema } from '../src/contracts/project'
import { validateGeometry } from '../src/modules/projects/geometry-validation'
const h=harness()
let owner:Account,other:Account
beforeAll(async()=>{owner=await account(h.app);other=await account(h.app)})
afterAll(async()=>{h.limits.close();await h.db.close()})
test('backend owns the complete template catalogue; every sample instantiates a valid editable project',async()=>{
  expect((await h.app.request('/api/v1/templates')).status).toBe(401)
  const catalogue=await (await request(h.app,owner,'/templates')).json()
  expect(catalogue.items).toHaveLength(9)
  for (const template of catalogue.items) {
    const response=await request(h.app,owner,`/templates/${template.id}/projects`,'POST',{duplicate:false})
    expect(response.status).toBe(201)
    const created=await response.json(),snapshot=await (await request(h.app,owner,`/projects/${created.projectId}`)).json()
    expect(snapshot.document.id).not.toBe(template.project.id);expect(snapshot.document.name).toBe(template.title)
    expect(snapshot.document.buildings).toEqual(template.project.buildings)
    expect(projectSchema.safeParse(snapshot.document).success).toBe(true);expect(()=>validateGeometry(snapshot.document)).not.toThrow()
    expect((await request(h.app,other,`/projects/${created.projectId}`)).status).toBe(404)
  }
})
test('template creation retries are idempotent, copies are separate and clients cannot replace template geometry',async()=>{
  const path='/templates/house/projects',headers={'Idempotency-Key':crypto.randomUUID()}
  const first=await (await request(h.app,owner,path,'POST',{duplicate:true},headers)).json()
  const second=await (await request(h.app,owner,path,'POST',{duplicate:true},headers)).json()
  expect(first).toEqual(second)
  const another=await (await request(h.app,owner,path,'POST',{duplicate:true})).json()
  expect(another.projectId).not.toBe(first.projectId)
  expect((await request(h.app,owner,path,'POST',{duplicate:false},headers)).status).toBe(409)
  expect((await request(h.app,owner,path,'POST',{duplicate:true,document:{name:'Fake'}})).status).toBe(422)
  expect((await request(h.app,owner,'/templates/missing/projects','POST',{duplicate:false})).status).toBe(404)
})
