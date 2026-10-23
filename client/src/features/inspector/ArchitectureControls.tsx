import type { Building, Level } from '../../domain/types'
import { removeArchitecture } from '../../domain/arenaArchitecture'
import { useProject } from '../../state/project'
export function ArchitectureControls({ building, level }: { building: Building; level: Level }) {
  const edit = useProject((state) => state.editProject)
  if (!building.architecture || building.architecture.sourceLevelId !== level.id) return null
  return (
    <details className="architecture-controls">
      <summary>Legacy sports concept</summary>
      <p>Arena generation has been retired. This saved concept remains visible in your project.</p>
      <button
        onClick={() =>
          edit((project) => {
            removeArchitecture(project, building.id)
            return project
          })
        }
      >
        Remove inferred architecture
      </button>
    </details>
  )
}
