import {expect,test} from 'bun:test'
import {sectionalPanelPose} from '../src/geometry/sectionalDoor'
test('garage door panels travel up and turn below the lintel onto an overhead track',()=>{
 const height=2.4
 expect(sectionalPanelPose(height,.2,0)).toEqual({y:.2,z:0,rotation:0})
 for(let progress=0;progress<=1;progress+=.025)for(let i=0;i<6;i++){
  const p=sectionalPanelPose(height,(i+.5)*height/6,progress)
  expect([p.y,p.z,p.rotation].every(Number.isFinite)).toBe(true)
  expect(p.y).toBeLessThanOrEqual(height);expect(p.rotation).toBeGreaterThanOrEqual(-Math.PI/2)
 }
 const raised=sectionalPanelPose(height,.2,1)
 expect(raised.y).toBe(height);expect(raised.rotation).toBe(-Math.PI/2);expect(raised.z).toBeLessThan(0)
})
