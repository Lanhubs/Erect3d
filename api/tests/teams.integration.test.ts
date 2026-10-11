import { afterAll,beforeAll,expect,test } from 'bun:test'
import { account,fixture,harness,request,type Account } from './helpers'
const h=harness()
let owner:Account,member:Account,foreign:Account
beforeAll(async()=>{ owner=await account(h.app);member=await account(h.app);foreign=await account(h.app) })
afterAll(async()=>{ h.limits.close();await h.db.close() })
test('invitations enforce recipient identity, idempotency and role boundaries without persisting raw tokens',async()=>{
  const team=await (await request(h.app,owner,'/teams','POST',{ name:'Architects' })).json()
  const [user]=await h.db`SELECT email FROM users WHERE id=${member.id}`
  const key=crypto.randomUUID(),input={ email:user.email,role:'EDITOR' }
  const invitation=await (await request(h.app,owner,`/teams/${team.id}/invitations`,'POST',input,{ 'Idempotency-Key':key })).json()
  const repeat=await (await request(h.app,owner,`/teams/${team.id}/invitations`,'POST',input,{ 'Idempotency-Key':key })).json()
  expect(repeat.id).toBe(invitation.id);expect(repeat.token).toBeUndefined()
  const [cached]=await h.db`SELECT response FROM idempotency_keys WHERE actor_id=${owner.id} AND key=${key}`
  expect(JSON.stringify(cached.response)).not.toContain(invitation.token)
  expect((await request(h.app,foreign,'/teams/invitations/accept','POST',{ token:invitation.token })).status).toBe(404)
  expect((await request(h.app,member,'/teams/invitations/accept','POST',{ token:invitation.token })).status).toBe(200)
  const document=fixture()
  expect((await request(h.app,member,'/projects','POST',{ document,teamId:team.id })).status).toBe(201)
  expect((await request(h.app,foreign,`/projects/${document.id}`)).status).toBe(404)
  expect((await request(h.app,member,`/teams/${team.id}/members/${owner.id}`,'DELETE')).status).toBe(403)
  expect((await request(h.app,owner,`/teams/${team.id}/members/${owner.id}`,'DELETE')).status).toBe(409)
  expect((await request(h.app,owner,`/teams/${team.id}/transfer`,'POST',{ userId:member.id })).status).toBe(204)
  expect((await request(h.app,owner,`/teams/${team.id}/members/${member.id}`,'PATCH',{ role:'VIEWER' })).status).toBe(403)
})
test('project component libraries stop being visible after membership removal',async()=>{
  const document=fixture()
  await request(h.app,owner,'/projects','POST',{ document })
  await request(h.app,owner,`/projects/${document.id}/members/${member.id}`,'PUT',{ role:'EDITOR' })
  const created=await (await request(h.app,member,'/library','POST',{ name:'Project finish',scope:'project',projectId:document.id,
    item:{ kind:'material',data:{ key:'plaster',color:'#ffffff',roughness:.8 } } })).json()
  expect(created.id).toBeDefined()
  expect((await (await request(h.app,member,'/library')).json()).items.some((item:{ id:string })=>item.id===created.id)).toBe(true)
  await request(h.app,owner,`/projects/${document.id}/members/${member.id}`,'DELETE')
  expect((await (await request(h.app,member,'/library')).json()).items.some((item:{ id:string })=>item.id===created.id)).toBe(false)
})
test('team ownership governs team projects and removed creators lose all access',async()=>{
  const team=await (await request(h.app,owner,'/teams','POST',{ name:'Studio' })).json()
  const [user]=await h.db`SELECT email FROM users WHERE id=${member.id}`
  const invitation=await (await request(h.app,owner,`/teams/${team.id}/invitations`,'POST',{ email:user.email,role:'EDITOR' })).json()
  await request(h.app,member,'/teams/invitations/accept','POST',{ token:invitation.token })
  const document=fixture(),path=`/projects/${document.id}`
  expect((await request(h.app,member,'/projects','POST',{ document,teamId:team.id })).status).toBe(201)
  expect((await request(h.app,owner,`${path}/settings`,'PATCH',{ allowClientApproval:true })).status).toBe(204)
  expect((await request(h.app,member,`${path}/settings`,'PATCH',{ allowClientApproval:false })).status).toBe(403)
  expect((await request(h.app,owner,`/teams/${team.id}/members/${member.id}`,'DELETE')).status).toBe(204)
  expect((await request(h.app,member,path)).status).toBe(404)
  const listed=await (await request(h.app,member,'/projects')).json()
  expect(listed.items.some((item:{ id:string })=>item.id===document.id)).toBe(false)
})
