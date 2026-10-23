import { useState } from 'react'
import type { Level, Project, Stair } from '../../domain/types'
import { connectStairGuide } from '../../domain/stairGuides'
import { useProject } from '../../state/project'

export function StairGuidesPanel({
  project,
  level,
  target,
  form,
}: {
  project: Project
  level: Level
  target?: Level
  form: Stair['form']
}) {
  const [reverse, setReverse] = useState(false),
    [error, setError] = useState('')
  const editProject = useProject((state) => state.editProject)
  if (!level.stairGuides?.length) return null
  const connect = (id: string) => {
    if (!target) return
    const issue = connectStairGuide(structuredClone(project), level.id, id, target.id, form, reverse)
    if (issue) {
      setError(issue)
      return
    }
    setError('')
    editProject((copy) => {
      connectStairGuide(copy, level.id, id, target.id, form, reverse)
      return copy
    })
  }
  return (
    <div className="structure-card">
      <b>Detected stair footprints</b>
      <small>
        Confirm the flight form and direction, then connect to the selected upper level. A floor plan alone
        does not specify the floor rise.
      </small>
      {!target && <small>Add an upper level to connect these footprints.</small>}
      <label>
        <input type="checkbox" checked={reverse} onChange={(event) => setReverse(event.target.checked)} />{' '}
        Reverse ascent direction
      </label>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {level.stairGuides.map((guide, index) => (
        <div className="structure-row" key={guide.id}>
          <span>
            Footprint {index + 1} · {guide.treadCount || '?'} drawn treads
          </span>
          <button
            onClick={() => connect(guide.id)}
            disabled={
              !target ||
              level.locked ||
              target.locked ||
              level.stairs?.some((stair) => stair.guideId === guide.id)
            }
          >
            Connect footprint
          </button>
          <button
            disabled={level.locked}
            onClick={() =>
              editProject((copy) => {
                const current = copy.buildings[0].levels.find((item) => item.id === level.id)
                if (current) current.stairGuides = current.stairGuides?.filter((item) => item.id !== guide.id)
                return copy
              })
            }
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
