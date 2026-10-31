// The cloud transport reads window.location.origin while it loads, so a test that follows a
// signed download has to look like a browser before the first cloud module is imported.
import { afterAll } from 'bun:test'
const createdHere = typeof globalThis.window === 'undefined'
if (createdHere)
  globalThis.window = {
    location: { origin: 'https://cloud.test' },
    dispatchEvent: () => false,
  } as unknown as Window & typeof globalThis
// Bun evaluates every test file in one process, so a browser stand-in left behind would change
// how later files see the shared cloud module.
afterAll(() => {
  if (createdHere) delete (globalThis as { window?: Window & typeof globalThis }).window
})
