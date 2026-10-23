import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const root = fileURLToPath(new URL('../', import.meta.url))
const write = process.argv.includes('--write')
// Enumerate source-controlled/new source paths, never traverse private local artifacts.
const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter((name) => /\.(?:[cm]?[jt]sx?|json|css|md|html|ya?ml)$/.test(name) && !name.startsWith('.local/'))
let checked = 0,
  changed = 0
for (const name of names) {
  const file = `${root}/${name}`
  const info = await prettier.getFileInfo(file, { ignorePath: `${root}/.prettierignore` })
  if (info.ignored || !info.inferredParser) continue
  let source
  try {
    source = await readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  const config = await prettier.resolveConfig(file)
  const formatted = await prettier.format(source, { ...config, filepath: file })
  checked++
  if (formatted === source) continue
  changed++
  if (write) await writeFile(file, formatted)
  else console.error(name)
}
console.log(`${checked} files checked; ${changed} ${write ? 'formatted' : 'need formatting'}.`)
if (!write && changed) process.exitCode = 1
