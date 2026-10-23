import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const baseline: Record<string, number> = await Bun.file(
  new URL('../../tools/api-file-size-baselines.json', import.meta.url),
).json()
const violations: string[] = []
let files = 0,
  maximum = 0
for (const file of new Bun.Glob('{src,client,scripts,tests}/**/*.{ts,tsx}').scanSync(root)) {
  const count = (await Bun.file(`${root}/${file}`).text()).trimEnd().split(/\r?\n/).length
  files++
  maximum = Math.max(maximum, count)
  const key = file.replaceAll('\\', '/')
  const limit = Math.min(500, baseline[key] || 200)
  if (count > limit) violations.push(`${file}: ${count} lines (limit ${limit}; extract a focused module)`)
}
if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log(
  `API file-size guard passed: ${files} files, maximum ${maximum} lines. New files: 200; formatted legacy files: no growth; hard ceiling: 500.`,
)
