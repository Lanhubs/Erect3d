import {useState} from 'react'
import type {Building,Level} from '../../domain/types'
import type {VisionBrief} from '../../../../api/src/contracts/vision'
import {defaultArenaVision} from '../../domain/architectureTypes'
import {createArenaArchitecture,removeArchitecture} from '../../domain/arenaArchitecture'
import {useProject} from '../../state/project'
export function ArchitectureControls({building,level}:{building:Building;level:Level}) {
  const edit=useProject(state=>state.editProject),[error,setError]=useState('')
  const vision=building.architecture,brief=vision?.brief || defaultArenaVision
  if(!vision && !level.rooms.some(room=>['basketball-court','football-pitch','table-tennis-hall'].includes(room.category || '')))return null
  const generate=(change:Partial<VisionBrief>={})=>{
    setError('');try{edit(project=>{
      const result=createArenaArchitecture(project,vision?.sourceLevelId || level.id,{...brief,...change,
        ...(change.style?{facadeColor:undefined,seatColor:undefined}:{})})
      if(result.buildings.find(item=>item.id===building.id)?.architecture)result.buildings.find(item=>item.id===building.id)!.architecture!.origin='user-selected'
      return result
    })}catch(cause){setError((cause as Error).message)}
  }
  return <details className="architecture-controls"><summary>Architecture concept{vision?' · inferred':''}</summary>
    <p>Editable roof, seating, concourse, glazing and circulation. These design choices go beyond measured plan evidence.</p>
    <label>Roof coverage<select value={brief.roofCoverage} onChange={event=>generate({roofCoverage:event.target.value as VisionBrief['roofCoverage']})}>
      <option value="partial">Partial daylight canopy</option><option value="full">Full covered arena</option><option value="open">Open bowl / concourse canopy</option></select></label>
    <label>Style<select value={brief.style} onChange={event=>generate({style:event.target.value as VisionBrief['style']})}>
      <option value="civic-modern">Modern civic</option><option value="warm-modern">Warm modern</option><option value="industrial">Industrial steel</option></select></label>
    <label>Seating rows<input type="number" min="4" max="24" value={brief.seatingRows} onChange={event=>{const value=Number(event.target.value);if(value>=4 && value<=24)generate({seatingRows:Math.round(value)})}}/></label>
    <label>Hall clearance (m)<input type="number" min="8" max="24" value={brief.clearance} onChange={event=>{const value=Number(event.target.value);if(value>=8 && value<=24)generate({clearance:value})}}/></label>
    <label>Glazed towers<select value={brief.towerCount} onChange={event=>generate({towerCount:Number(event.target.value) as 0|2|4})}><option value="4">Four towers</option><option value="2">Two towers</option><option value="0">No towers</option></select></label>
    <button onClick={()=>generate()}>{vision?'Rebuild concept':'Create architectural concept'}</button>
    {vision && <><p>{brief.rationale}</p><button onClick={()=>edit(project=>{removeArchitecture(project,building.id);return project})}>Remove inferred architecture</button></>}
    {error && <p role="alert">{error}</p>}
  </details>
}
