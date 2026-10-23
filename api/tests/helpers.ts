import { readConfig } from '../src/config/env'
import { createServices } from '../src/config/services'
import { createApp } from '../src/app'
import { newId } from '../src/security/tokens'
import type { Project } from '../src/contracts/project'
import type { ObjectStore } from '../src/storage/objects'
import { unpackSource } from '../src/storage/archive'
import type { PlanIntelligenceProvider } from '../src/modules/ai/provider'
import type { EditingProvider } from '../src/modules/assistant/provider'
export const origin = 'http://127.0.0.1:5173'
export function harness(
  overrides: {
    store?: ObjectStore
    provider?: PlanIntelligenceProvider
    editingProvider?: EditingProvider
    ai?: boolean
  } = {},
) {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Integration tests require TEST_DATABASE_URL with a database ending in _test')
  const config = readConfig({
    DATABASE_URL: url,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: origin,
    SNAPSHOT_INTERVAL: 2,
    ...(overrides.ai ? { GEMINI_API_KEY: 'fake-test-key' } : {}),
  })
  const services = createServices(config, overrides),
    app = createApp(services)
  return { ...services, app }
}
export type Harness = ReturnType<typeof harness>
export type Account = { id: string; cookie: string; csrf: string }
export async function account(app: Harness['app']): Promise<Account> {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test user',
      email: `${crypto.randomUUID()}@example.test`,
      password: 'safe-test-password-123',
    }),
  })
  const data = await response.json()
  if (response.status !== 201) throw new Error(JSON.stringify(data))
  return { id: data.user.id, cookie: response.headers.get('set-cookie')!.split(';')[0], csrf: data.csrfToken }
}
export function request(
  app: Harness['app'],
  user: Account,
  path: string,
  method = 'GET',
  input?: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: user.cookie,
      'X-CSRF-Token': user.csrf,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
      ...headers,
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  })
}
export function fixture(): Project {
  return {
    id: newId('project'),
    name: 'Test house',
    modified: Date.now(),
    units: 'm',
    sources: [],
    buildings: [
      {
        id: newId('building'),
        name: 'House',
        levels: [
          {
            id: newId('level'),
            name: 'Ground floor',
            elevation: 0,
            slabThickness: 0.2,
            walls: [
              {
                id: newId('wall'),
                start: { x: 0, z: 0 },
                end: { x: 8, z: 0 },
                thickness: 0.2,
                height: 3,
                material: 'plaster',
              },
            ],
            doors: [],
            windows: [],
            rooms: [],
          },
        ],
      },
    ],
  }
}
export async function createProject(app: Harness['app'], user: Account, document = fixture()) {
  const response = await request(app, user, '/projects', 'POST', { document })
  if (response.status !== 201) throw new Error(JSON.stringify(await response.json()))
  return document
}
export class MemoryStore implements ObjectStore {
  objects = new Map<string, Uint8Array>()
  uploadUrl(key: string) {
    return `https://storage.example.test/put/${key}`
  }
  downloadUrl(key: string) {
    return `https://storage.example.test/get/${key}`
  }
  async read(key: string, maximum: number) {
    const value = this.objects.get(key)
    if (!value || value.length > maximum) throw new Error('Invalid object')
    return unpackSource(key, value, maximum)
  }
  async stat(key: string) {
    const value = this.objects.get(key)
    if (!value) throw new Error('Invalid object')
    return { size: value.length }
  }
  async write(key: string, bytes: Uint8Array) {
    this.objects.set(key, bytes)
  }
  async delete(key: string) {
    this.objects.delete(key)
  }
  async probe() {}
}
