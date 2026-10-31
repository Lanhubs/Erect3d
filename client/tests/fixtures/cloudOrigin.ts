// The cloud transport reads window.location.origin while it loads, so a test that follows a
// signed download has to look like a browser before the first cloud module is imported.
if (typeof globalThis.window === 'undefined')
  globalThis.window = {
    location: { origin: 'https://cloud.test' },
    dispatchEvent: () => false,
  } as unknown as Window & typeof globalThis
