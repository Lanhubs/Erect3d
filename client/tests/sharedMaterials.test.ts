import { expect, test } from 'bun:test'
import { Texture, type MeshStandardMaterial } from 'three'
import { RenderResources } from '../src/rendering/RenderResources'
test('matching architectural finishes share a material while textures and selection colors stay independent', () => {
  const resources = new RenderResources(),
    map = new Texture(),
    otherMap = new Texture()
  map.toJSON = () => {
    throw new Error('Material pooling must not serialize texture images')
  }
  const first = resources.standard({ color: '#c0b090', roughness: 0.8, map }) as MeshStandardMaterial
  expect(resources.standard({ map, roughness: 0.8, color: '#c0b090' })).toBe(first)
  expect(resources.standard({ color: '#c0b090', roughness: 0.8, map: otherMap })).not.toBe(first)
  expect(resources.standard({ color: '#e0a545', roughness: 0.8, map })).not.toBe(first)
  expect(first.map).toBe(map)
  expect(first.roughness).toBe(0.8)
  expect(first.color.getHexString()).toBe('c0b090')
  resources.dispose()
  map.dispose()
  otherMap.dispose()
})
test('shared surfaces are released only after their last mesh leaves the resource scope', async () => {
  const resources = new RenderResources(),
    material = resources.standard({ color: '#625a4b' })
  let disposed = 0
  material.addEventListener('dispose', () => disposed++)
  resources.retain(material)
  resources.retain(material)
  resources.release(material)
  await Promise.resolve()
  expect(disposed).toBe(0)
  resources.release(material)
  resources.retain(material)
  await Promise.resolve()
  expect(disposed).toBe(0)
  resources.release(material)
  await Promise.resolve()
  expect(disposed).toBe(1)
  expect(resources.materials.size).toBe(0)
  resources.dispose()
})
