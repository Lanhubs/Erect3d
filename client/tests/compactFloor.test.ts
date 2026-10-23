import { expect, test } from 'bun:test'
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Texture } from 'three'
import { captureFloor, disposeCapturedFloor } from '../src/geometry/captureFloor'
import { compactFloor } from '../src/geometry/compactFloor'
test('compatible linked-floor parts share baked geometry while preserving bounds, UVs and floor instancing', () => {
  const root = new Group(),
    geometry = new BoxGeometry(2, 2, 2),
    first = new MeshStandardMaterial({ color: '#aaaaaa' }),
    second = first.clone()
  const a = new Mesh(geometry, first),
    b = new Mesh(geometry, second)
  a.position.set(2, 3, 4)
  b.position.set(-5, 1, 0)
  root.add(a, b)
  const captured = captureFloor(root, 43),
    packed = compactFloor(captured)
  expect(captured).toHaveLength(2)
  expect(packed).toHaveLength(1)
  expect(packed[0].matrices).toEqual([new Matrix4()])
  expect(packed[0].geometry.boundingBox!.min.toArray()).toEqual([-6, 0, -1])
  expect(packed[0].geometry.boundingBox!.max.toArray()).toEqual([3, 4, 5])
  expect(packed[0].geometry.getAttribute('uv').count).toBe(72)
  let borrowed = 0,
    owned = 0
  geometry.addEventListener('dispose', () => borrowed++)
  packed[0].geometry.addEventListener('dispose', () => owned++)
  disposeCapturedFloor(packed)
  expect(borrowed).toBe(0)
  expect(owned).toBe(1)
  geometry.dispose()
  first.dispose()
  second.dispose()
})
test('material comparison reuses texture identities without encoding image data', () => {
  const root = new Group(),
    geometry = new BoxGeometry(),
    texture = new Texture()
  texture.source.toJSON = () => {
    throw new Error('Compacting a floor must not encode textures')
  }
  const first = new MeshStandardMaterial({ map: texture }),
    second = first.clone(),
    other = new MeshStandardMaterial({ map: new Texture() })
  root.add(new Mesh(geometry, first), new Mesh(geometry, second), new Mesh(geometry, other))
  const packages = compactFloor(captureFloor(root, 20))
  expect(packages).toHaveLength(2)
  disposeCapturedFloor(packages)
  geometry.dispose()
  first.dispose()
  second.dispose()
  other.map!.dispose()
  other.dispose()
  texture.dispose()
})
test('different finishes, shadows, partial draws and reflected meshes keep separate packages', () => {
  const root = new Group(),
    geometry = new BoxGeometry(),
    white = new MeshStandardMaterial(),
    red = new MeshStandardMaterial({ color: 'red' })
  const meshes = [
    new Mesh(geometry, white),
    new Mesh(geometry, red),
    new Mesh(geometry, white.clone()),
    new Mesh(geometry.clone(), white.clone()),
  ]
  meshes[2].castShadow = true
  meshes[3].scale.x = -1
  root.add(...meshes)
  const partial = new Mesh(geometry.clone(), white.clone())
  partial.geometry.setDrawRange(0, 6)
  root.add(partial)
  expect(compactFloor(captureFloor(root, 21))).toHaveLength(5)
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose()
      ;(object.material as MeshStandardMaterial).dispose()
    }
  })
})
test('custom material callbacks keep their original meshes without serialization or geometry loss', () => {
  const root = new Group(),
    material = new MeshStandardMaterial(),
    geometries = [new BoxGeometry(), new BoxGeometry(2, 2, 2)]
  material.onBeforeCompile = () => {}
  material.toJSON = () => {
    throw new Error('Custom material serialization is unsupported')
  }
  geometries.forEach((geometry) => root.add(new Mesh(geometry, material)))
  const source = captureFloor(root, 20),
    packed = compactFloor(source)
  expect(packed).toHaveLength(2)
  expect(packed[0]).toBe(source[0])
  expect(packed[1]).toBe(source[1])
  disposeCapturedFloor(packed)
  geometries.forEach((geometry) => geometry.dispose())
  material.dispose()
})
