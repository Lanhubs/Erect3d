import type { ArchitecturalRequirements } from '../../contracts/architectural-requirements'
import type { Point } from '../../contracts/project'
type Requirement = Extract<ArchitecturalRequirements['systems'][number], { kind: 'void' }>
export function sourceVoid<T extends { elevation: number; assumptions?: string[] }>(
  base: T,
  polygon: Point[],
  requirement: Requirement,
  slabThickness: number,
) {
  const openBelow =
    requirement.origin === 'detected' &&
    /open\s*(?:to\s*)?below/i.test(`${requirement.name} ${requirement.evidence}`) &&
    !/open[ -]air|courtyard/i.test(requirement.evidence)
  // OPEN TO BELOW is a hole in the depicted storey's slab, not a courtyard
  // through the roof and not a hole in the lower living room's floor.
  return {
    ...base,
    kind: 'void' as const,
    polygon,
    role: requirement.role || 'atrium',
    height: openBelow ? slabThickness + 0.02 : requirement.parameters.height,
    ...(openBelow
      ? {
          elevation: -slabThickness - 0.01,
          assumptions: [
            ...(base.assumptions || []),
            'Open-to-below is represented as this floor opening; the roof and lower floor remain intact.',
          ].slice(0, 20),
        }
      : {}),
  }
}
