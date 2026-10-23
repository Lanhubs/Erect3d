import { Texture, type MeshStandardMaterialParameters } from 'three'
// Texture identity includes sampling/repeat state. Do not encode image pixels
// or collapse distinct maps while finding matching architectural finishes.
export function standardMaterialKey(parameters: MeshStandardMaterialParameters) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(parameters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value instanceof Texture ? value.uuid : value]),
    ),
  )
}
