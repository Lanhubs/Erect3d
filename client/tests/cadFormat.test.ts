import { expect, test } from 'bun:test'
import {
  binaryDxfMessage,
  cadAccept,
  cadExtension,
  cadFormatFromMime,
  cadMimeFor,
  detectCadFile,
  sniffCadFile,
} from '../src/features/import/cadFormat'

const file = (content: string, name: string, type = '') =>
  new File([Uint8Array.from(content, (character) => character.charCodeAt(0))], name, { type })

test('a CAD file is recognised by its name as well as its header', async () => {
  expect(cadExtension('Floor.Plan.DWG')).toBe('dwg')
  expect(cadExtension('sheet-01.dxf')).toBe('dxf')
  expect(cadExtension('plan.pdf')).toBeUndefined()
  expect(cadMimeFor('dwg')).toBe('image/vnd.dwg')
  expect(cadMimeFor('dxf')).toBe('image/vnd.dxf')
  expect(cadFormatFromMime('image/vnd.dxf')).toBe('dxf')
  expect(cadFormatFromMime('image/png')).toBeUndefined()
  expect(cadAccept).toContain('.dwg')
  expect(cadAccept.split(',')).toContain('image/vnd.dxf')
})

test('the header decides the format when the file name lies', async () => {
  expect(await detectCadFile(file('AC1027', 'labelled-as-dxf.dxf'))).toBe('dwg')
  expect(await detectCadFile(file('  0\nSECTION\n  2\nHEADER\n', 'saved-as-dwg.dwg'))).toBe('dxf')
  // A file with no CAD name is never tried, however much its header looks like a drawing.
  expect(await detectCadFile(file('AC1027', 'floorplan'))).toBeUndefined()
})

test('an ASCII DXF is classified from its section markers', async () => {
  const dxf = file('  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n', 'floor.dxf')
  expect(await sniffCadFile(dxf)).toEqual({ format: 'dxf', binary: false })
  expect(await detectCadFile(dxf)).toBe('dxf')
  expect(await sniffCadFile(file('$ACADVER', 'header-only'))).toEqual({ format: 'dxf', binary: false })
})

test('AutoCAD Binary DXF is refused with instructions, not converted', async () => {
  const nul = '\u0000\u0001\u0002'
  await expect(detectCadFile(file(`AutoCAD Binary DXF\r\nAC1027${nul}`, 'legacy.dxf'))).rejects.toThrow(
    binaryDxfMessage,
  )
  // Binary DXF repeats the DWG version stamp after the sentinel, so a DWG name cannot rescue it.
  await expect(
    detectCadFile(file(`AC1027${nul.slice(0, 2)}AutoCAD Binary DXF\r\n`, 'legacy.dwg')),
  ).rejects.toThrow(binaryDxfMessage)
  expect(await sniffCadFile(file(`AutoCAD Binary DXF\r\nAC1027${nul}`, 'legacy.dxf'))).toEqual({
    binary: true,
  })
})

test('anything that is not a drawing is left to the existing importers', async () => {
  expect(await detectCadFile(file('Plan notes in plain text', 'note.txt'))).toBeUndefined()
  expect(await detectCadFile(file('%PDF-1.7', 'floor.pdf', 'application/pdf'))).toBeUndefined()
  expect(await sniffCadFile(file('', 'empty'))).toEqual({ binary: false })
})
