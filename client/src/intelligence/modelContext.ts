import type { Candidate, AnalysisInput } from '../../../api/src/contracts/analysis'
import type { Project, Point } from '../domain/types'
import { atWall } from '../geometry/math'
export function modelContext(project: Project, input: AnalysisInput, width: number, height: number): Candidate[] {
  const level = project.buildings.flatMap(building => building.levels).find(level => level.id === input.levelId)
  if (!level) return []
  const scale = input.calibration.metresPerPixel
  const point = (p: Point) => ({ x: ((p.x - (input.alignment?.x || 0)) / scale + input.calibration.a.x) / width,
    y: ((p.z - (input.alignment?.z || 0)) / scale + input.calibration.a.z) / height })
  const base = (entity: { id: string }): Pick<Candidate, 'id' | 'targetId' | 'confidence' | 'evidence' | 'uncertainties' | 'needsReview' | 'confirmedFields'> => ({
    id: entity.id, targetId: entity.id, confidence: 1, evidence: 'Existing editable model; changes require explicit review',
    uncertainties: [], needsReview: true, confirmedFields: project.interpretation?.[entity.id]?.confirmedFields || Object.keys(entity).filter(key => key !== 'id'),
  })
  const result: Candidate[] = level.walls.map(wall => ({ ...base(wall), kind: 'wall', points: [point(wall.start), point(wall.end)],
    thickness: wall.thickness / (width * scale), heightMetres: wall.height,wallKind:wall.kind,
    curve: wall.curve ? { ...wall.curve, center: point(wall.curve.center), radius: wall.curve.radius / (width * scale) } : undefined }))
  for (const item of [...level.doors, ...level.windows, ...(level.passages || [])]) {
    const door = level.doors.find(door => door.id === item.id)
    const window=level.windows.find(window=>window.id===item.id)
    const wall = level.walls.find(wall => wall.id === item.wallId)
    if (!wall) continue
    result.push({ ...base(item), kind: door ? 'door' : level.windows.some(window => window.id === item.id) ? 'window' : 'passage',
      wallId: wall.id, points: [point(atWall(wall, item.offset)), point(atWall(wall, item.offset + item.width))],
      heightMetres: item.height, ...(door ? { hinge: door.hinge, swing: door.swing, doorStyle: door.style } : window?{sillMetres:window.sill,windowType:window.type}:{}) })
  }
  for (const room of level.rooms) result.push({ ...base(room), kind: 'room', points: room.polygon.map(point), label: room.name })
  for (const column of level.columns || []) {
    const halfX = column.width / 2, halfZ = column.depth / 2
    result.push({ ...base(column), kind: 'column', columnShape: column.shape, heightMetres: column.height,
      points: [point({ x: column.position.x - halfX, z: column.position.z - halfZ }),
        point({ x: column.position.x + halfX, z: column.position.z - halfZ }), point({ x: column.position.x + halfX, z: column.position.z + halfZ }),
        point({ x: column.position.x - halfX, z: column.position.z + halfZ })] })
  }
  return result.filter(candidate => candidate.points.every(p => p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1)
    && (!candidate.curve || candidate.curve.center.x >= 0 && candidate.curve.center.x <= 1 && candidate.curve.center.y >= 0 && candidate.curve.center.y <= 1)
    && (!candidate.thickness || candidate.thickness <= .1)).slice(0, 2000)
}
