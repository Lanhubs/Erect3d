import { expect, test } from 'bun:test'
import { modelViewAction } from '../src/app/modelViewAction'

test('3D button builds detected geometry after analysis instead of opening an empty viewer', () => {
  expect(modelViewAction('completed', 25, 0, true)).toBe('build')
  expect(modelViewAction('building', 0, 0, true)).toBe('wait')
  expect(modelViewAction('idle', 0, 0, true)).toBe('analyze')
  expect(modelViewAction('idle', 0, 24, true)).toBe('show')
})
