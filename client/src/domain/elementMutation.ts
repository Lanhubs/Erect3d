import { mutateSystem } from './systemEditing'
import type { Building, Point, Selection } from './types'
import { selectedElement, pointsCenter, type ElementChange } from './elementGeometry'
import { nearestWallOffset, wallWithEndpoint } from '../geometry/math'
import { updateFenceBoundary } from '../geometry/site'
import { updateStair } from './structure'
import type { Project } from './types'
import { furnitureIssues } from '../furniture/entities'

export function mutateElement(
  project: Project,
  building: Building,
  selection: NonNullable<Selection>,
  change: ElementChange,
): string | null {
  if (selection.kind === 'architecture') return mutateSystem(building, selection.id, change)
  const target = selectedElement(building, selection)
  if (!target) return 'Select a building element first.'
  const { level, element, points } = target
  if (level.locked) return 'Unlock this level before editing.'
  const center = pointsCenter(points),
    angle = ((change.rotate || 0) * Math.PI) / 180,
    scale = change.scale ?? 1
  const map = (point: Point): Point => {
    const x = (point.x - center.x) * scale,
      z = (point.z - center.z) * scale
    return {
      x: center.x + x * Math.cos(angle) - z * Math.sin(angle) + (change.move?.x || 0),
      z: center.z + x * Math.sin(angle) + z * Math.cos(angle) + (change.move?.z || 0),
    }
  }
  const mapped = points.map((point, index) =>
    change.vertex?.index === index ? change.vertex.point : map(point),
  )
  if ('wallId' in element) {
    const wall = level.walls.find((item) => item.id === element.wallId)!
    if (change.move) element.offset = nearestWallOffset(wall, map(points[0])).offset
    if (change.vertex) {
      const offset = nearestWallOffset(wall, change.vertex.point).offset
      if (change.vertex.index === 0) {
        element.width += element.offset - offset
        element.offset = offset
      } else element.width = offset - element.offset
    }
    if (change.scale) {
      element.offset += (element.width * (1 - scale)) / 2
      element.width *= scale
    }
    if (change.height) element.height += change.height
    return change.rotate ? 'Openings remain aligned with their host wall. Rotate the wall instead.' : null
  }
  if (selection.kind === 'fence' && 'segments' in element) {
    Object.assign(element, updateFenceBoundary(element, mapped))
    if (change.height) {
      element.height += change.height
      element.segments.forEach((segment) => {
        segment.height = element.height
      })
    }
    return null
  }
  if (selection.kind === 'stair' && 'fromLevelId' in element) {
    if (change.vertex || change.height)
      return 'Use stair dimensions to change the flight; floor elevations determine its rise.'
    return updateStair(project, element.id, {
      start: map(element.start),
      direction: element.direction + (change.rotate || 0),
      width: element.width * scale,
      treadDepth: element.treadDepth * scale,
      landingLength: element.landingLength * scale,
    })
  }
  if ('polygon' in element) {
    element.polygon = mapped
    if ('openings' in element) {
      element.autoFromWalls = false
      element.openings
        .filter((opening) => opening.kind !== 'stair')
        .forEach((opening) => {
          opening.polygon = opening.polygon.map(map)
        })
      level.rooms
        .filter((room) => JSON.stringify(room.polygon) === JSON.stringify(points))
        .forEach((room) => {
          room.polygon = mapped
        })
    }
    if ('ceilingHeight' in element || selection.kind === 'room') {
      const room = level.rooms.find((item) => item.id === element.id)!
      if (change.height) room.ceilingHeight = (room.ceilingHeight || 2.8) + change.height
      level.slabs
        ?.filter((slab) => JSON.stringify(slab.polygon) === JSON.stringify(points))
        .forEach((slab) => {
          slab.polygon = mapped
          slab.openings
            .filter((opening) => opening.kind !== 'stair')
            .forEach((opening) => {
              opening.polygon = opening.polygon.map(map)
            })
        })
    } else if ('thickness' in element && change.height) element.thickness += change.height
  } else if ('position' in element) {
    element.position = change.vertex?.point || map(element.position)
    element.width *= scale
    element.depth *= scale
    if ('diameter' in element) element.diameter *= scale
    element.rotation = (element.rotation || 0) + (change.rotate || 0)
    if (change.height) element.height += change.height
    if ('levelId' in element) element.roomId = furnitureIssues(element, level, building.levels).roomId
  } else if ('start' in element && 'end' in element) {
    if (selection.kind === 'wall' && 'thickness' in element && 'height' in element) {
      const proposed = change.vertex
        ? wallWithEndpoint(element, change.vertex.index === 0 ? 'start' : 'end', change.vertex.point)
        : {
            ...element,
            start: mapped[0],
            end: mapped[1],
            ...(element.curve
              ? {
                  curve: {
                    ...element.curve,
                    center: map(element.curve.center),
                    radius: element.curve.radius * scale,
                    startAngle: element.curve.startAngle + angle,
                    endAngle: element.curve.endAngle + angle,
                  },
                }
              : {}),
          }
      Object.assign(element, proposed)
      // Keep shared corners, room footprints and fitted floor/roof boundaries attached to the edited wall.
      const follow = (point: Point) => {
        const index = points.findIndex((old) => Math.hypot(point.x - old.x, point.z - old.z) < 0.015)
        return index < 0 ? point : { ...[element.start, element.end][index] }
      }
      level.walls
        .filter((wall) => wall.id !== element.id && !wall.curve)
        .forEach((wall) => {
          wall.start = follow(wall.start)
          wall.end = follow(wall.end)
        })
      level.rooms.forEach((room) => {
        room.polygon = room.polygon.map(follow)
      })
      level.slabs?.forEach((slab) => {
        slab.polygon = slab.polygon.map(follow)
      })
      building.roofSections
        ?.filter((section) => section.levelId === level.id && section.followFootprint)
        .forEach((section) => {
          section.footprint = section.footprint.map(follow)
          section.voids = section.voids?.map((ring) => ring.map(follow))
        })
    } else {
      element.start = mapped[0]
      element.end = mapped[1]
    }
    if ('width' in element) element.width *= scale
    if ('depth' in element) element.depth *= scale
    if ('outward' in element) element.outward = map(element.outward)
    if (change.height) {
      if ('height' in element) element.height += change.height
      else if ('endElevation' in element) element.endElevation += change.height
      else if ('baseElevation' in element) element.baseElevation += change.height
    }
  }
  return null
}
