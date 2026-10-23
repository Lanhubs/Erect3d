import { MeshPhysicalMaterial, type BufferGeometry } from 'three'
import type { FurniturePart } from './parts'
import { furnitureGeometry, geometryKey } from './geometry'
export const materialKey = (p: FurniturePart) =>
  `${p.finish}:${p.color}:${p.roughness}:${p.metalness}:${p.opacity ?? 1}`
export class FurnitureResources {
  geometries = new Map<string, BufferGeometry>()
  materials = new Map<string, MeshPhysicalMaterial>()
  references = new Map<string, number>()
  geometry(part: FurniturePart) {
    const key = geometryKey(part)
    if (!this.geometries.has(key))
      this.geometries.set(key, furnitureGeometry(part.shape, part.size, part.finish === 'fabric'))
    return this.geometries.get(key)!
  }
  material(part: FurniturePart) {
    const key = materialKey(part)
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new MeshPhysicalMaterial({
          color: part.color,
          roughness: part.roughness,
          metalness: part.metalness,
          sheen: part.finish === 'fabric' ? 0.65 : 0,
          sheenRoughness: 0.85,
          sheenColor: part.color,
          clearcoat: part.finish === 'ceramic' ? 0.32 : part.finish === 'timber' ? 0.12 : 0,
          clearcoatRoughness: 0.24,
          transparent: (part.opacity ?? 1) < 1,
          opacity: part.opacity ?? 1,
          depthWrite: (part.opacity ?? 1) === 1,
          ior: 1.5,
        }),
      )
    return this.materials.get(key)!
  }
  retain(part: FurniturePart) {
    for (const key of ['g:' + geometryKey(part), 'm:' + materialKey(part)])
      this.references.set(key, (this.references.get(key) || 0) + 1)
  }
  release(part: FurniturePart) {
    const g = geometryKey(part),
      m = materialKey(part)
    for (const key of ['g:' + g, 'm:' + m])
      this.references.set(key, Math.max(0, (this.references.get(key) || 0) - 1))
    queueMicrotask(() => {
      if (this.references.get('g:' + g) === 0) {
        this.geometries.get(g)?.dispose()
        this.geometries.delete(g)
        this.references.delete('g:' + g)
      }
      if (this.references.get('m:' + m) === 0) {
        this.materials.get(m)?.dispose()
        this.materials.delete(m)
        this.references.delete('m:' + m)
      }
    })
  }
  dispose() {
    this.geometries.forEach((g) => g.dispose())
    this.materials.forEach((m) => m.dispose())
    this.geometries.clear()
    this.materials.clear()
  }
}
