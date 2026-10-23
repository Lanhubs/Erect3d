import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { FurnitureObject } from './types'
import type { FurniturePart } from './parts'
export function partTransform(object: FurnitureObject, part: FurniturePart) {
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (-object.rotation * Math.PI) / 180)
  const rotation = yaw
    .clone()
    .multiply(new Quaternion().setFromEuler(new Euler(...(part.rotation || [0, 0, 0]))))
  const position = new Vector3(...part.at)
    .applyQuaternion(yaw)
    .add(new Vector3(object.position.x, 0, object.position.z))
  return new Matrix4().compose(
    position,
    rotation,
    new Vector3(...(part.shape === 'soft-box' ? ([1, 1, 1] as const) : part.size)),
  )
}
