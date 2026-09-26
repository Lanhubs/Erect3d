import type { Level } from '../domain/types'
import { atWall } from '../geometry/math'

export function drawWalkMap(canvas: HTMLCanvasElement, level: Level, x: number, z: number, yaw: number) {
  const context = canvas.getContext('2d')
  if (!context) return
  const width = canvas.width, height = canvas.height
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  const minX = Math.min(x, ...points.map(point => point.x)) - 1
  const maxX = Math.max(x, ...points.map(point => point.x)) + 1
  const minZ = Math.min(z, ...points.map(point => point.z)) - 1
  const maxZ = Math.max(z, ...points.map(point => point.z)) + 1
  const scale = Math.min((width - 20) / Math.max(1, maxX - minX), (height - 20) / Math.max(1, maxZ - minZ))
  const px = (worldX: number) => (width - (maxX - minX) * scale) / 2 + (worldX - minX) * scale
  const py = (worldZ: number) => (height - (maxZ - minZ) * scale) / 2 + (worldZ - minZ) * scale
  context.fillStyle = '#f5f6f2'; context.fillRect(0, 0, width, height)
  context.strokeStyle = '#526057'; context.lineWidth = 3
  for (const wall of level.walls) {
    context.beginPath(); context.moveTo(px(wall.start.x), py(wall.start.z))
    context.lineTo(px(wall.end.x), py(wall.end.z)); context.stroke()
  }
  context.strokeStyle = '#be945b'; context.lineWidth = 4
  for (const door of level.doors) {
    const wall = level.walls.find(item => item.id === door.wallId)
    if (!wall) continue
    const a = atWall(wall, door.offset), b = atWall(wall, door.offset + door.width)
    context.beginPath(); context.moveTo(px(a.x), py(a.z)); context.lineTo(px(b.x), py(b.z)); context.stroke()
  }
  context.save(); context.translate(px(x), py(z)); context.rotate(-yaw)
  context.fillStyle = '#a35f2d'; context.beginPath()
  context.moveTo(0, -9); context.lineTo(-6, 7); context.lineTo(6, 7); context.closePath(); context.fill()
  context.restore()
}
