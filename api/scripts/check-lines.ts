import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const violations: string[] = []
let files = 0, maximum = 0
for (const file of new Bun.Glob('{src,client,scripts,tests}/**/*.{ts,tsx}').scanSync(root)) {
  const count = (await Bun.file(`${root}/${file}`).text()).trimEnd().split(/\r?\n/).length
  files++; maximum = Math.max(maximum, count)
  if (count > 200) violations.push(`${file}: ${count} lines`)
}
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log(`API source files meet the 200-line limit: ${files} files, maximum ${maximum} lines`)
