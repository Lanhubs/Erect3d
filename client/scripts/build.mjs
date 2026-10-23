import { spawnSync } from 'node:child_process'
import { cp, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const client = fileURLToPath(new URL('../', import.meta.url)),
  film = fileURLToPath(new URL('../../motion-video/', import.meta.url))
function run(args, cwd) {
  const result = spawnSync('bun', args, { cwd, stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) process.exit(result.status || 1)
}
run(['run', 'typecheck'], client)
run(['node_modules/vite/bin/vite.js', 'build'], client)
run(['run', 'build'], film)
const target = new URL('../dist/motion/erect3d-film/', import.meta.url)
await mkdir(target, { recursive: true })
await cp(new URL('../../motion-video/dist/', import.meta.url), target, { recursive: true })
console.log('Editor and independent film web builds are ready in client/dist.')
