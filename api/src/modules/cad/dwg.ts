import { access, constants } from 'node:fs/promises'
import { runConverter } from './binary'
import { CadFailure, type CadLimits } from './types'

type ConverterSettings = Pick<CadLimits, 'timeoutMs' | 'maxBytes'> & { executable?: string }

/** Operator installs LibreDWG (dwg2dxf / dxf2dwg) or a wrapper that keeps the same argv shape: BIN -o OUTPUT INPUT. */
export function converterAvailable(executable?: string) {
  if (!executable) return Promise.resolve(false)
  return access(executable, constants.X_OK)
    .then(() => true)
    .catch(() => false)
}

export async function dwgToDxf(bytes: Uint8Array, settings: ConverterSettings): Promise<string> {
  if (!settings.executable)
    throw new CadFailure(
      'DWG_CONVERT_FAILED',
      'No DWG converter is installed; export the drawing as ASCII DXF',
    )
  const run = await runConverter({
    executable: settings.executable,
    label: 'dwg2dxf',
    inputName: 'source.dwg',
    outputName: 'source.dxf',
    input: bytes,
    arguments: ({ input, output }) => ['-o', output, input],
    timeoutMs: settings.timeoutMs,
    maxOutputBytes: settings.maxBytes,
  })
  if (!run.ok || !run.bytes)
    throw new CadFailure('DWG_CONVERT_FAILED', `DWG could not be read (${run.reason || 'unknown error'})`)
  return new TextDecoder('utf-8', { fatal: false }).decode(run.bytes)
}

export async function dxfToDwg(bytes: Uint8Array, settings: ConverterSettings): Promise<Uint8Array> {
  if (!settings.executable)
    throw new CadFailure('DWG_CONVERT_FAILED', 'DWG export needs an installed dxf2dwg converter')
  const run = await runConverter({
    executable: settings.executable,
    label: 'dxf2dwg',
    inputName: 'model.dxf',
    outputName: 'model.dwg',
    input: bytes,
    arguments: ({ input, output }) => ['-o', output, input],
    timeoutMs: settings.timeoutMs,
    maxOutputBytes: settings.maxBytes,
  })
  if (!run.ok || !run.bytes)
    throw new CadFailure('DWG_CONVERT_FAILED', `DWG could not be written (${run.reason || 'unknown error'})`)
  return run.bytes
}
