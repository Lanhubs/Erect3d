import { expect, test } from 'bun:test'
import { privateAssetUrl } from '../src/cloud/api'

const signed = 'https://bucket.example.net/assets/asset_raster.png?token=abc%20123&expires=1790000000'
const ticket = '/api/v1/assets/jobs/job_1/download'

// Object storage signs the whole URL and the local store hands back only a ticket path. Both have
// to work without the other's assumption: a base of "/" whenever the app origin is empty used to
// throw "Invalid URL" on every signed download.
test('a fully signed asset URL is returned exactly as issued', () => {
  expect(privateAssetUrl(signed)).toBe(signed)
  expect(privateAssetUrl(signed, 'https://app.test')).toBe(signed)
  expect(privateAssetUrl(signed, '')).toBe(signed)
})

test('a signed URL keeps its scheme, host, path and decoded query', () => {
  const url = new URL(privateAssetUrl(signed, ''))
  expect([url.protocol, url.hostname, url.pathname, url.searchParams.get('token')]).toEqual([
    'https:',
    'bucket.example.net',
    '/assets/asset_raster.png',
    'abc 123',
  ])
})

test('a ticket path resolves against the app origin', () => {
  expect(privateAssetUrl(ticket, 'https://app.test')).toBe(`https://app.test${ticket}`)
  expect(privateAssetUrl(ticket, 'https://app.test/')).toBe(`https://app.test${ticket}`)
})

test('a ticket path without an app origin is refused instead of resolving somewhere wrong', () => {
  expect(() => privateAssetUrl(ticket, '')).toThrow('Invalid URL')
})
