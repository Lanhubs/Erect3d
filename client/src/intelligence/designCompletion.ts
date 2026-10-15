import type { DesignProposal } from '../../../api/src/contracts/design'
import type { Project } from '../domain/types'
import { setBuildingRoof } from '../domain/roofDesign'
import { ProposalError } from './errors'
export function applyDesigns(input: Project, levelId: string, designs: DesignProposal[]) {
  const project = structuredClone(input), building = project.buildings.find(building => building.levels.some(level => level.id === levelId))
  const level = building?.levels.find(level => level.id === levelId)
  if (!level || !building || level.locked) throw new ProposalError(409, 'LEVEL_LOCKED', 'Unlock the target level first')
  if (designs.filter(design => design.kind === 'roof').length > 1) throw new ProposalError(422,'ROOF_ALTERNATIVE','Choose only one roof alternative')
  const targets = new Set<string>()
  for (const design of designs) {
    if (design.kind === 'roof') {
      if (building.levels.some(level => level.locked)) throw new ProposalError(409,'LEVEL_LOCKED','Unlock all building levels before changing its roof choices')
      setBuildingRoof(building, design.roof)
      continue
    }
    for (const id of design.entityIds) {
      const key = `${design.kind}:${id}`
      if (targets.has(key)) throw new ProposalError(422,'DESIGN_ALTERNATIVE','Choose one finish or glazing alternative per element')
      targets.add(key)
      if (design.kind === 'wall-finish') {
        const wall = level.walls.find(wall => wall.id === id)
        if (!wall) throw new ProposalError(422,'DESIGN_TARGET','Wall finish target is not on the analyzed level')
        wall.material = design.material; if (design.color) wall.color = design.color
      } else {
        const window = level.windows.find(window => window.id === id)
        if (!window) throw new ProposalError(422,'DESIGN_TARGET','Glazing target is not on the analyzed level')
        window.frame = design.frame; window.glazing = design.glazing; window.type = design.type
      }
      project.interpretation ||= {}
      project.interpretation[id] = { ...project.interpretation[id], origin: 'user-selected',
        confirmedFields: [...new Set([...(project.interpretation[id]?.confirmedFields || []), ...(design.kind === 'wall-finish' ? ['material','color'] : ['frame','glazing','type'])])] }
    }
  }
  return project
}
