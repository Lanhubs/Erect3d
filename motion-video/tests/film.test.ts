import {expect,test} from 'bun:test'
import {cameraAt,editStep,progress,FILM,scenes} from '../src/timeline'
import {filmProject,ground,selectedWindow,windowAt,planSvg} from '../src/model'
import {validateGeometry} from '../../api/src/modules/projects/geometry-validation'
import {projectSchema} from '../../api/src/contracts/project'
test('all 1051 timeline frames are finite and seek independent, including the final hold',()=>{
 expect(FILM.duration).toBe(35);expect(scenes.map(s=>s.start)).toEqual([0,3,8,12,19,24,28,32])
 for(let n=0;n<=1050;n++){const t=n/30,a=cameraAt(t);expect([...a.position,...a.target,a.fov].every(Number.isFinite)).toBe(true);cameraAt(35-t);expect(cameraAt(t)).toEqual(a);expect(a.position[1]).toBeGreaterThan(0)}
 expect(progress(-1,12,14)).toBe(0);expect(progress(20,12,14)).toBe(1)
})
test('film uses a valid isolated sample with real connected stairs and a hosted editable window',()=>{
 expect(projectSchema.safeParse(filmProject).success).toBe(true);expect(()=>validateGeometry(filmProject)).not.toThrow()
 const original=JSON.stringify(filmProject)
 expect(ground.stairs?.[0].toLevelId).toBe(filmProject.buildings[0].levels[1].id)
 for(const t of [35,0,26.5,25.8,24]){const w=windowAt(t);expect(w.wallId).toBe(selectedWindow.wallId);expect(w.width).toBeGreaterThanOrEqual(1.6);expect(w.width).toBeLessThanOrEqual(2.4)}
 expect(editStep(24)).toBe(0);expect(editStep(27)).toBe(10);expect(planSvg(1.6)).not.toBe(planSvg(2.4));expect(JSON.stringify(filmProject)).toBe(original)
})
