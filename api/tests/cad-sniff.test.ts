import { expect, test } from 'bun:test'
import { cadMimeFor, cadMimeToFormat, isBinaryDxf, sniffCadFormat } from '../src/modules/cad/signature'
import { validateAsset } from '../src/modules/assets/validation'
import { ApiError } from '../src/security/errors'
import { dxfPlanFixture } from './dxf-fixture'

const bytes = (text: string) => new TextEncoder().encode(text)
const asciiDxf = bytes(dxfPlanFixture)

test('DWG version stamp is detected at the start of the file', () => {
  expect(sniffCadFormat(bytes('AC1032'))).toBe('dwg')
  expect(sniffCadFormat(bytes('AC1015\r\n\x1a\x00Rest'))).toBe('dwg')
})

test('ASCII DXF is detected from its section and marker words', () => {
  expect(sniffCadFormat(asciiDxf)).toBe('dxf')
  expect(sniffCadFormat(bytes('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n'))).toBe('dxf')
  expect(sniffCadFormat(bytes('\uFEFF0\nSECTION\n2\nHEADER\n9\n$ACADVER\n'))).toBe('dxf')
})

test('binary DXF is rejected instead of guessed as DWG', () => {
  const binary = new Uint8Array([...bytes('AC1015'), 13, 10, 26, 0, ...bytes('AutoCAD Binary DXF'), 0, 1, 2])
  expect(isBinaryDxf(binary)).toBe(true)
  expect(sniffCadFormat(binary)).toBeNull()
})

test('CAD formats map to and from their registered MIME types', () => {
  expect(cadMimeFor('dwg')).toBe('image/vnd.dwg')
  expect(cadMimeFor('dxf')).toBe('image/vnd.dxf')
  expect(cadMimeToFormat('image/vnd.dxf')).toBe('dxf')
  expect(cadMimeToFormat('image/vnd.dwg')).toBe('dwg')
  expect(cadMimeToFormat('image/png')).toBeNull()
})

test('CAD sources validate as source documents and refuse other categories', async () => {
  expect(await validateAsset(asciiDxf, 'image/vnd.dxf', 'source')).toMatchObject({ format: 'dxf-original' })
  await expect(validateAsset(asciiDxf, 'image/vnd.dxf', 'raster')).rejects.toThrow(ApiError)
})

test('CAD content may not be uploaded as an image and images are not CAD', async () => {
  await expect(validateAsset(asciiDxf, 'image/png', 'source')).rejects.toThrow(/contents do not match/)
  await expect(validateAsset(bytes('AC1015'), 'image/vnd.dxf', 'source')).rejects.toThrow(
    /contents do not match/,
  )
})
