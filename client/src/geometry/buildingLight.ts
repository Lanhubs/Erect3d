import { OrthographicCamera, Vector3 } from 'three'
type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number; bottom: number; top: number }
// Fit light-space bounds to the complete building and its ground shadow. A
// fixed ground-floor frustum clips tall buildings and changes the sun angle.
export function buildingLight(bounds: Bounds) {
  const target = new Vector3(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.top + bounds.bottom) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  )
  const direction = new Vector3(-0.6, 1, 0.5).normalize()
  const span = Math.max(
    8,
    Math.hypot(bounds.maxX - bounds.minX, bounds.top - bounds.bottom, bounds.maxZ - bounds.minZ),
  )
  const position = target.clone().addScaledVector(direction, span * 2 + 10)
  const camera = new OrthographicCamera()
  camera.position.copy(position)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  const points: Vector3[] = []
  for (const x of [bounds.minX, bounds.maxX])
    for (const z of [bounds.minZ, bounds.maxZ]) {
      points.push(new Vector3(x, bounds.bottom, z), new Vector3(x, bounds.top, z))
      const height = bounds.top - bounds.bottom
      points.push(
        new Vector3(
          x - (direction.x / direction.y) * height,
          bounds.bottom,
          z - (direction.z / direction.y) * height,
        ),
      )
    }
  const lightPoints = points.map((p) => p.clone().applyMatrix4(camera.matrixWorldInverse)),
    pad = Math.max(0.5, span * 0.01)
  return {
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    points,
    view: camera.matrixWorldInverse.clone(),
    left: Math.min(...lightPoints.map((p) => p.x)) - pad,
    right: Math.max(...lightPoints.map((p) => p.x)) + pad,
    bottom: Math.min(...lightPoints.map((p) => p.y)) - pad,
    top: Math.max(...lightPoints.map((p) => p.y)) + pad,
    near: Math.max(0.1, Math.min(...lightPoints.map((p) => -p.z)) - pad),
    far: Math.max(...lightPoints.map((p) => -p.z)) + pad,
  }
}
