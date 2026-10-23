import { expect, test } from 'bun:test'
import { checkBaseline, summarizeLcov } from '../coverage-summary.mjs'

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
