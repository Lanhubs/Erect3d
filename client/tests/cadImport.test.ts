import './fixtures/cloudOrigin'
import { afterAll, beforeEach, expect, test } from 'bun:test'
import { api } from '../src/cloud/api'
import { setCloudPersistence, type CloudPersistence } from '../src/state/persistenceMode'
import { houseSample } from '../src/domain/residentialSamples'
import type { Project } from '../src/domain/types'
import { cloudRequiredMessage, importCadDrawing } from '../src/features/import/cadImport'
import {
  cadFailureMessage,
  waitForCadConversion,
  type CadConverted,
} from '../src/features/import/cadTransfer'

type CadTicket = { jobId: string | null; rasterAssetId?: string; width?: number; height?: number }

const converted: CadConverted = {
  rasterAssetId: 'asset_raster',
  width: 2400,
  height: 1600,
  units: 'mm',
  metresPerPixel: 0.025,
  warnings: ['Layer "PUBLISH" was hidden.'],
}

const cloudSession = (project: Project): CloudPersistence => ({
  projectId: project.id,
  save: async () => {},
  loadSource: async () => undefined,
  saveSource: async () => {},
})

/** The transport is faked end to end so the orchestration, not the server, is under test. */
function stubTransport(ticket: CadTicket) {
  const calls: string[] = []
  api.request = ((path: string, method = 'GET', input?: unknown) => {
    calls.push(`${method} ${path}`)
    if (path.includes('/assets/optimized-upload'))
      return Promise.resolve({ assetId: 'asset_original', metadata: {}, optimization: {} })
    if (path.endsWith('/cad/convert')) return Promise.resolve(ticket)
    if (path.includes('/jobs/')) return Promise.resolve({ status: 'completed', result: converted })
    if (path.endsWith('/download')) return Promise.resolve({ downloadUrl: 'https://storage.test/raster.png' })
    throw new Error(`unexpected request ${method} ${path} ${JSON.stringify(input)}`)
  }) as typeof api.request
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ capabilities: { privateAssets: true, cadImport: true, dwgImport: true } }),
      {
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch
  return calls
}

/**
 * The transport and the session are process-wide singletons. Bun shares globals between test
 * files, so anything left patched here silently changes a later file's expectations.
 */
const originalRequest = api.request,
  originalFetch = globalThis.fetch
beforeEach(() => setCloudPersistence(undefined))
afterAll(() => {
  api.request = originalRequest
  globalThis.fetch = originalFetch
  setCloudPersistence(undefined)
})

test('a device project is refused before a byte leaves the browser', async () => {
  const project = houseSample(),
    other = cloudSession({ ...houseSample(), id: 'project_other' })
  await expect(importCadDrawing(project, new File(['AC1027'], 'plan.dwg'), 'dwg', () => {})).rejects.toThrow(
    cloudRequiredMessage,
  )
  // A cloud session bound to another project is not this project's converter either.
  setCloudPersistence(other)
  await expect(importCadDrawing(project, new File(['AC1027'], 'plan.dwg'), 'dwg', () => {})).rejects.toThrow(
    cloudRequiredMessage,
  )
})

test('a drawing is uploaded, converted, and handed back as the raster the pipeline reads', async () => {
  const project = houseSample(),
    stages: string[] = []
  setCloudPersistence(cloudSession(project))
  const calls = stubTransport({ jobId: 'job_1' }),
    result = await importCadDrawing(
      project,
      new File(['AC1027 drawing'], 'tower level 3.dwg'),
      'dwg',
      (stage) => stages.push(stage),
    )
  expect(stages).toEqual(['uploading', 'converting', 'downloading'])
  expect(calls[0]).toContain('kind=source')
  expect(calls[0]).toContain('mime=image%2Fvnd.dwg')
  expect(calls[1]).toBe(`POST /projects/${project.id}/cad/convert`)
  expect(calls[2]).toBe(`GET /projects/${project.id}/jobs/job_1`)
  expect(result.document.mime).toBe('image/vnd.dwg')
  expect(result.document.name).toBe('tower level 3.dwg')
  expect(result.document.metresPerPixel).toBe(0.025)
  expect(result.document.units).toBe('mm')
  expect(result.pages).toBe(1)
  expect(result.blob.size).toBeGreaterThan(0)
  expect(result.document.id).toMatch(/^source_[0-9a-f-]{36}$/)
})

test('an already converted drawing is reused without a second job', async () => {
  const project = houseSample()
  setCloudPersistence(cloudSession(project))
  const calls = stubTransport({ jobId: null, rasterAssetId: 'asset_raster', width: 2400, height: 1600 }),
    result = await importCadDrawing(project, new File(['AC1027'], 'plan.dxf'), 'dxf', () => {})
  expect(calls.filter((call) => call.includes('/jobs/'))).toEqual([])
  expect(result.document.mime).toBe('image/vnd.dxf')
  expect(result.document.metresPerPixel).toBeUndefined()
  expect(result.document.units).toBe('unknown')
})

test('every conversion failure tells the architect what to change', () => {
  expect(cadFailureMessage('DWG_CONVERTER_UNAVAILABLE')).toContain('ASCII DXF')
  expect(cadFailureMessage('DXF_TOO_COMPLEX')).toContain('Purge or simplify')
  expect(cadFailureMessage('CAD_TIMEOUT')).toContain('simpler')
  expect(cadFailureMessage('SOMETHING_NEW')).toContain('SOMETHING_NEW')
  expect(cadFailureMessage(null)).toContain('unknown reason')
})

test('a job that ends without a result, or never ends, both stop with advice', async () => {
  api.request = (async () => ({ status: 'completed', result: null })) as typeof api.request
  await expect(waitForCadConversion('project_1', 'job_1', 5000)).rejects.toThrow('no result')
  api.request = (async () => ({ status: 'running' })) as typeof api.request
  await expect(waitForCadConversion('project_1', 'job_1', 10)).rejects.toThrow('Reload this floor')
  api.request = (async () => ({ status: 'failed', failure_code: 'DXF_EMPTY' })) as typeof api.request
  await expect(waitForCadConversion('project_1', 'job_1', 5000)).rejects.toThrow('no visible geometry')
})
