import { expect, test } from 'bun:test'
import { checkBaseline, summarizeLcov } from '../scripts/coverage-summary.mjs'

test('coverage gates exclude foreign imports and fixtures, preserve Windows paths, and reject empty reports', () => {
  const report =
    'SF:src\\model.ts\nLF:10\nLH:8\nFNF:5\nFNH:3\nend_of_record\nSF:../client/src/model.ts\nLF:100\nLH:100\nend_of_record'
  const result = summarizeLcov(report, (name: string) => name.startsWith('src/'))
  expect(result.files).toBe(1)
  expect(result.linePercent).toBe(80)
  expect(result.functionPercent).toBe(60)
  expect(checkBaseline(result, { files: 1, linePercent: 81, functionPercent: 60 })).toEqual(['linePercent'])
  expect(() => summarizeLcov('', () => true)).toThrow('no owned production')
})

test('coverage floors are keyed by the Bun release that measured them, including the pinned one', async () => {
  const read = async (path: string) => JSON.parse(await Bun.file(new URL(path, import.meta.url)).text())
  const floors = (await read('../tools/coverage-baselines.json')) as Record<string, Record<string, unknown>>
  const pinned = (await read('../package.json')).packageManager as string
  const packages = ['client', 'api', 'motion-video']
  for (const [version, recorded] of Object.entries(floors)) {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    for (const name of packages) {
      const floor = recorded[name] as Record<string, number>
      expect(floor, `${name} has no floor for Bun ${version}`).toBeObject()
      for (const key of ['linePercent', 'functionPercent', 'files']) expect(floor[key]).toBeNumber()
    }
  }
  // CI pins this version, so a missing key would fail every run rather than gate anything.
  expect(Object.keys(floors)).toContain(pinned.replace('bun@', ''))
})
