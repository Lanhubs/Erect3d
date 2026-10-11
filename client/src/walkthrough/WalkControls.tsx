import { uid, type Building } from '../domain/types'
import { useProject } from '../state/project'
import type { WalkOptions, WalkViewpoint } from './types'
export function WalkControls({ building, options, setOptions, active, current, savePoint }: {
  building: Building; options: WalkOptions; setOptions: (options: WalkOptions) => void; active: boolean; current: string; savePoint: () => WalkViewpoint | null
}) {
  const edit = useProject(state => state.editProject)
  return <div className="walk-settings">
    <label>Walk speed <select aria-label="Walk speed" value={options.speed} onChange={event => setOptions({ ...options, speed: event.target.value as WalkOptions['speed'] })}>
      <option value="normal">Normal</option><option value="fast">Fast</option></select></label>
    {!active && <label>Start from <select aria-label="Walk starting position" value={options.start} onChange={event => setOptions({ ...options, start: event.target.value })}>
      <option value="entrance">Main entrance</option><option value="camera">Current camera position</option><option value="room">Selected room</option>
      {building.walkViewpoints?.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
    </select></label>}
    {active && <><span>Current level: {current || 'Ground floor'} · Collision on</span><button onClick={() => {
      const point = savePoint(); if (!point) return
      edit(project => { const owner = project.buildings.find(item => item.id === building.id)!; owner.walkViewpoints ||= []
        owner.walkViewpoints.push({ ...point, id: uid('viewpoint'), name: `Viewpoint ${owner.walkViewpoints.length + 1}` }); return project })
    }}>Save viewpoint</button></>}
  </div>
}
