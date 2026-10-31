import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'

export type ConverterRun = { ok: boolean; bytes: Uint8Array | null; reason?: string }
export type ConverterRequest = {
  executable: string
  label: string
  inputName: string
  outputName: string
  input: Uint8Array
  arguments: (paths: { input: string; output: string; root: string }) => string[]
  timeoutMs: number
  maxOutputBytes: number
}

/** Runs an operator-installed CAD converter with no shell, no network and a private scratch dir. */
export async function runConverter(request: ConverterRequest): Promise<ConverterRun> {
  const root = await mkdtemp(join(tmpdir(), `erect3d-${request.label}-`))
  try {
    const input = join(root, basename(request.inputName)),
      output = join(root, basename(request.outputName))
    await writeFile(input, request.input, { mode: 0o600 })
    const child = Bun.spawn([request.executable, ...request.arguments({ input, output, root })], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, request.timeoutMs)
    let code: number
    try {
      code = await child.exited
    } finally {
      clearTimeout(timer)
    }
    if (timedOut) return { ok: false, bytes: null, reason: 'the converter timed out' }
    if (code !== 0) return { ok: false, bytes: null, reason: `the converter exited ${code}` }
    const info = await stat(output).catch(() => null)
    if (!info || !info.size) return { ok: false, bytes: null, reason: 'the converter produced no output' }
    if (info.size > request.maxOutputBytes)
      return { ok: false, bytes: null, reason: 'the converter output is larger than the permitted size' }
    return { ok: true, bytes: new Uint8Array(await readFile(output)) }
  } catch (error) {
    return { ok: false, bytes: null, reason: (error as Error).message }
  } finally {
    await disposeScratch(root, `erect3d-${request.label}-`)
  }
}

/** A converter must only ever be handed, and only ever have removed, a scratch directory we made. */
export async function disposeScratch(root: string, prefix: string) {
  if (!relative(resolve(tmpdir()), resolve(root)).startsWith(prefix))
    throw new Error('Unexpected converter cleanup path')
  await rm(root, { recursive: true, force: true })
}
