import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = (path: string) => Bun.file(`${root}/${path}`).text()

/**
 * Only the checked-in schema and the placeholder templates are opened here. A developer's
 * `.env`, `.env.local` and `.env.test` are never read, so this test cannot leak a secret.
 */
async function documentedKeys(path: string) {
  const lines = (await source(path)).split(/\r?\n/)
  return lines
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.slice(0, line.indexOf('=')))
}

/** Every name the runtime reads out of the environment, across a package's own sources. */
async function readKeys(globs: string[]) {
  const found = new Set<string>()
  for (const pattern of globs)
    for await (const file of new Bun.Glob(pattern).scanSync(`${root}/`)) {
      const text = await source(file)
      for (const match of text.matchAll(/(?:import\.meta\.env|process\.env)\??\.([A-Z][A-Z0-9_]*)/g))
        found.add(match[1])
    }
  return found
}

/** Schema keys are declared as `NAME: z...` at one nesting level inside `z.object({})`. */
async function schemaKeys(path: string) {
  const text = await source(path)
  return [...new Set([...text.matchAll(/^ {4}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]))]
}

const readTargets = ['api/src/**/*.{ts,tsx}', 'api/scripts/*.ts', 'api/tests/*.ts', 'scripts/*.mjs']

test('every API schema key is documented in api/.env.example', async () => {
  const keys = await schemaKeys('api/src/config/env.ts')
  expect(keys.length).toBeGreaterThan(40)
  const example = await documentedKeys('api/.env.example')
  expect(keys.filter((key) => !example.includes(key))).toEqual([])
})

test('api/.env.example documents no key that nothing reads', async () => {
  const schema = new Set(await schemaKeys('api/src/config/env.ts'))
  const read = await readKeys(readTargets)
  for (const key of await documentedKeys('api/.env.example')) {
    const used = schema.has(key) || read.has(key)
    expect(used, `${key} is documented but never read`).toBe(true)
  }
})

test('every client variable the editor reads is documented in client/.env.example', async () => {
  const project = [...(await readKeys(['client/src/**/*.{ts,tsx}', 'client/scripts/**/*.{ts,mjs}']))].filter(
    (key) => key.startsWith('VITE_') || key.startsWith('ERECT_'),
  )
  expect(project.length).toBeGreaterThan(0)
  const example = await documentedKeys('client/.env.example')
  expect(project.filter((key) => !example.includes(key))).toEqual([])
})

test('client/.env.example documents no variable the editor never reads', async () => {
  const read = await readKeys([
    'client/src/**/*.{ts,tsx}',
    'client/scripts/**/*.{ts,mjs}',
    'client/vite.config.ts',
    'client/*.config.ts',
  ])
  for (const key of await documentedKeys('client/.env.example'))
    expect(read.has(key), `${key} is documented but never read`).toBe(true)
})

test('the root example only documents the commands that read it', async () => {
  const read = await readKeys(['scripts/*.mjs', 'tests/*.ts', 'api/tests/*.ts'])
  for (const key of await documentedKeys('.env.example'))
    expect(read.has(key), `${key} is documented but never read`).toBe(true)
})

test('the storage rule the example describes is the rule the schema enforces', async () => {
  const { readConfig } = await import('../api/src/config/env')
  const base = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://erect:erect@127.0.0.1:55432/erect_config_test',
    STORAGE_BACKEND: 'filesystem',
  }
  expect(() => readConfig(base)).toThrow('STORAGE_ROOT')
  expect(() => readConfig({ ...base, STORAGE_ROOT: '/tmp/erect-storage' })).toThrow('STORAGE_ROOT')
  expect(() =>
    readConfig({ ...base, STORAGE_ROOT: '/tmp/erect-storage', STORAGE_SIGNING_KEY: 'x'.repeat(32) }),
  ).not.toThrow()
})
