import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { origin, type Account, type Harness } from './helpers'

export type CadUpload = { status: number; data: Record<string, any> }

/** The optimized binary upload the client uses for a drawing; returns the status and JSON body. */
export async function uploadCad(
  h: Harness,
  user: Account,
  projectId: string,
  bytes: BodyInit,
  mime: string,
  kind = 'source',
): Promise<CadUpload> {
  const response = await h.app.request(
    `/api/v1/projects/${projectId}/assets/optimized-upload?name=Plan&kind=${kind}&mime=${encodeURIComponent(mime)}`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: user.cookie,
        'X-CSRF-Token': user.csrf,
        'Content-Type': mime,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: bytes,
    },
  )
  return { status: response.status, data: (await response.json().catch(() => ({}))) as Record<string, any> }
}

export type FakeConverter = { executable: string; dispose: () => Promise<void> }

/**
 * Stands in for an operator-installed LibreDWG. The wrapper contract is BIN -o OUTPUT INPUT, so the
 * fake verifies the argv shape and the DWG version stamp, then writes the DXF a real converter emits.
 */
export async function fakeDwgConverter(dxf: string, version = 'AC1027'): Promise<FakeConverter> {
  const root = await mkdtemp(join(tmpdir(), 'erect3d-fake-dwg-')),
    script = join(root, 'converter.mjs'),
    windows = process.platform === 'win32'
  await writeFile(
    script,
    `import { readFile } from 'node:fs/promises'
const args = process.argv.slice(2)
if (args[0] !== '-o' || !args[1] || !args[2]) process.exit(3)
const head = (await readFile(args[2])).subarray(0, ${version.length}).toString()
if (head !== '${version}') process.exit(4)
await Bun.write(args[1], ${JSON.stringify(dxf)})
`,
  )
  const executable = join(root, windows ? 'dwg2dxf.cmd' : 'dwg2dxf')
  await writeFile(
    executable,
    windows
      ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
  )
  if (!windows) await chmod(executable, 0o755)
  return { executable, dispose: () => rm(root, { recursive: true, force: true }) }
}
