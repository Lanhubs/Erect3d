type Wall = { x1: number; y1: number; x2: number; y2: number; thicknessPixels: number }
type Edge = { horizontal: boolean; start: number; end: number; fixed: number; stroke: number }
// Keep the full native band as the single geometric source. Fine strokes that
// extend past it or fall outside its pixels remain independent evidence.
export function coveredStroke(edge: Edge, walls: Wall[]) {
  const points = edge.horizontal
    ? [
        [edge.start, edge.fixed],
        [edge.end, edge.fixed],
      ]
    : [
        [edge.fixed, edge.start],
        [edge.fixed, edge.end],
      ]
  return walls.some((wall) => {
    const dx = wall.x2 - wall.x1,
      dy = wall.y2 - wall.y1,
      length = Math.hypot(dx, dy)
    if (length < 1 || edge.stroke > wall.thicknessPixels + 2) return false
    return points.every(([x, y]) => {
      const along = ((x - wall.x1) * dx + (y - wall.y1) * dy) / length
      const across = Math.abs((x - wall.x1) * dy - (y - wall.y1) * dx) / length
      return along >= -0.5 && along <= length + 0.5 && across <= wall.thicknessPixels / 2 + 0.5
    })
  })
}
