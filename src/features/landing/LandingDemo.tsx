import { Suspense, lazy, useEffect, useMemo } from 'react'
import { fixtureProject } from '../../domain/fixture'
import { PlanEditor } from '../plan/PlanEditor'
import { useProject } from '../../state/project'

const Viewer = lazy(() => import('../../rendering/Viewer').then(module => ({ default: module.Viewer })))

export function LandingDemo() {
  const project = useMemo(() => fixtureProject('Courtyard residence'), [])
  const level = project.buildings[0].levels[0]
  const setProject = useProject(s => s.setProject)
  const setActiveLevel = useProject(s => s.setActiveLevel)
  const setTool = useProject(s => s.setTool)
  const setView = useProject(s => s.setView)

  useEffect(() => {
    setProject(project)
    setActiveLevel(level.id)
    setTool('select')
    setView('split')
  }, [level.id, project, setActiveLevel, setProject, setTool, setView])

  return (
    <div className="landing-demo">
      <div className="landing-demo-panel landing-demo-plan">
        <div className="demo-label">2D PLAN</div>
        <PlanEditor level={level} selection={null} select={() => {}} unit={project.units} />
      </div>

      <div className="landing-demo-divider" aria-hidden="true">
        →
      </div>

      <div className="landing-demo-panel landing-demo-model">
        <div className="demo-label">3D BUILDING</div>
        <Suspense fallback={<div className="viewer-loading">Preparing 3D model…</div>}>
          <Viewer
            building={project.buildings[0]}
            activeLevelId={level.id}
            selection={null}
            select={() => {}}
            roofShown
            setRoofShown={() => {}}
          />
        </Suspense>
      </div>
    </div>
  )
}
