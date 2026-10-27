import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountPanel } from '../src/cloud/AccountPanel'

test('signed-out accounts render the sign-in form without missing session-state bindings', () => {
  const html = renderToStaticMarkup(<AccountPanel />)
  expect(html).toContain('Sign in to your projects')
  expect(html.toLowerCase()).toContain('autocomplete="username"')
  expect(html.toLowerCase()).toContain('autocomplete="current-password"')
})
