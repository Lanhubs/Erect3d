import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  LatheGeometry,
  Vector2,
  Shape,
  ExtrudeGeometry,
  type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { FurniturePart, FurnitureShape } from './parts'
export function geometryKey(part: FurniturePart) {
  return part.shape === 'soft-box' ? `${part.shape}:${part.finish}:${part.size.join(',')}` : part.shape
}
// Rounded parts are built in metres: stretching a unit bevel made thin doors,
// cushions and headboards acquire visibly different corner radii on each axis.
export function furnitureGeometry(
  shape: FurnitureShape,
  size: [number, number, number] = [1, 1, 1],
  fabric = false,
  preview = false,
): BufferGeometry {
  let geometry: BufferGeometry
  if (shape === 'soft-box') {
    geometry = new RoundedBoxGeometry(...size, preview ? 1 : 3, Math.min(...size) * (fabric ? 0.42 : 0.16))
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
  if (shape === 'box') geometry = new BoxGeometry(1, 1, 1)
  else if (shape === 'cylinder') geometry = new CylinderGeometry(0.5, 0.5, 1, preview ? 12 : 32)
  else if (shape === 'taper') geometry = new CylinderGeometry(0.36, 0.5, 1, preview ? 8 : 24)
  else if (shape === 'sphere') geometry = new SphereGeometry(0.5, preview ? 12 : 32, preview ? 8 : 20)
  else if (shape === 'ring')
    geometry = new TorusGeometry(0.44, 0.06, preview ? 6 : 10, preview ? 16 : 40)
      .rotateX(Math.PI / 2)
      .scale(1, 1 / 0.12, 1)
  else if (shape === 'bowl') {
    // Closed ceramic shell: outer underside -> rolled lip -> sloping inner bowl.
    // The interior descends below the lip; there is no painted top or flat lid.
    const profile = [
      [0, -0.5],
      [0.22, -0.5],
      [0.33, -0.47],
      [0.43, -0.3],
      [0.49, 0.27],
      [0.5, 0.43],
      [0.49, 0.49],
      [0.46, 0.5],
      [0.43, 0.46],
      [0.42, 0.28],
      [0.35, -0.12],
      [0.23, -0.3],
      [0, -0.32],
    ]
    geometry = new LatheGeometry(
      profile.map(([x, y]) => new Vector2(x, y)),
      preview ? 16 : 48,
    )
  } else {
    const shape = new Shape(),
      angle = Math.PI * 0.39,
      steps = 24
    for (let i = 0; i <= steps; i++) {
      const t = -angle + (2 * angle * i) / steps,
        x = Math.sin(t) * 0.5,
        z = -Math.cos(t) * 0.5
      i ? shape.lineTo(x, z) : shape.moveTo(x, z)
    }
    for (let i = steps; i >= 0; i--) {
      const t = -angle + (2 * angle * i) / steps
      shape.lineTo(Math.sin(t) * 0.45, -Math.cos(t) * 0.45)
    }
    shape.closePath()
    geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 }).rotateX(
      -Math.PI / 2,
    )
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!,
      span = box.max.clone().sub(box.min),
      center = box.min.clone().add(box.max).multiplyScalar(0.5)
    geometry.translate(-center.x, -center.y, -center.z).scale(1 / span.x, 1 / span.y, 1 / span.z)
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
