import type {ArticulationSystem} from '../../domain/buildingSystems'
import {articulationProfiles,architecturalSurfaces} from '../../domain/articulation'
export function ArticulationFields({system,patch}:{system:ArticulationSystem;patch:(change:Record<string,unknown>)=>void}){
  return <>
    <label className="inspector-field"><span>Profile</span><select value={system.profile} onChange={e=>patch({profile:e.target.value,...(['balcony','railing'].includes(e.target.value)?{height:1.1}:{})})}>{articulationProfiles.map(profile=><option key={profile}>{profile}</option>)}</select></label>
    <label className="inspector-field"><span>Surface</span><select value={system.material} onChange={e=>patch({material:e.target.value})}>{architecturalSurfaces.map(material=><option key={material}>{material}</option>)}</select></label>
    <label className="inspector-field"><span>Projection side</span><select value={system.side} onChange={e=>patch({side:e.target.value})}><option value="left">Left of source path</option><option value="right">Right of source path</option></select></label>
    <label className="inspector-field"><span>Repeat on linked floors</span><input type="checkbox" checked={!!system.repeatWithFloor} onChange={e=>patch({repeatWithFloor:e.target.checked})}/></label>
  </>
}
