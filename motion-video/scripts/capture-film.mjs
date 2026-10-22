#!/usr/bin/env node
/**
 * Deterministic frame grabber for the Erect3D motion film.
 *
 * Drives headless Chrome over the DevTools Protocol with no dependencies
 * beyond Node 18+ (global WebSocket). For every frame it asks the film to
 * render that exact timestamp, then takes the screenshot, so the output is
 * frame-for-frame reproducible.
 *
 *   node scripts/capture-film.mjs --url http://127.0.0.1:5199/motion/erect3d-film \
 *        --out .local/film-frames --frames 0,150,300
 *
 * Options:
 *   --url      film url (the script appends ?capture=1)
 *   --out      output directory for PNG frames
 *   --frames   comma separated frame numbers, or "all"
 *   --step     frame step when using --frames all (default 1)
 *   --fps      film frame rate (default 30)
 *   --chrome   path to the Chrome/Edge binary
 *   --keep     keep the browser running
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const flag = name => args.includes(`--${name}`)

const FILM_URL = option('url', 'http://127.0.0.1:5199/motion/erect3d-film')
const OUT = resolve(option('out', '.local/film-frames'))
const FPS = Number(option('fps', '30'))
const PORT = Number(option('port', '9333'))
const FRAME_SPEC = option('frames', 'all')
const STEP = Number(option('step', '1'))

const CHROME_CANDIDATES = [
  option('chrome', ''),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const browserPath = CHROME_CANDIDATES.find(path => existsSync(path))
if (!browserPath) {
  console.error('No Chrome or Edge binary found. Pass --chrome <path>.')
  process.exit(1)
}

const profile = join(tmpdir(), `erect3d-film-${Date.now()}`)
await mkdir(profile, { recursive: true })

const browser = spawn(
  browserPath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1920,1080',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--mute-audio',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)

const sleep = ms => new Promise(done => setTimeout(done, ms))

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) return (await response.json()).webSocketDebuggerUrl
    } catch {
      /* not listening yet */
    }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging endpoint.')
}

class Session {
  constructor(socket) {
    this.socket = socket
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`))
        else resolve(message.result)
        return
      }
      const handler = this.handlers.get(message.method)
      if (handler) handler(message.params)
    })
  }

  send(method, params = {}, sessionId) {
    this.id += 1
    const id = this.id
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.socket.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`${method} timed out`))
        }
      }, 120000)
    })
  }
}

const url = new URL(FILM_URL)
url.searchParams.set('capture', '1')

const socket = new WebSocket(await endpoint())
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true })
  socket.addEventListener('error', rejectOpen, { once: true })
})
const session = new Session(socket)

const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: true })

await session.send('Page.enable', {}, sessionId)
await session.send('Runtime.enable', {}, sessionId)
await session.send(
  'Emulation.setDeviceMetricsOverride',
  { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false },
  sessionId,
)
await session.send('Page.navigate', { url: url.toString() }, sessionId)

const evaluate = async expression => {
  const result = await session.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  )
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluation failed')
  return result.result.value
}

let ready = false
for (let attempt = 0; attempt < 240; attempt += 1) {
  ready = await evaluate('Boolean(window.__erect3dFilm && window.__erect3dFilm.ready)')
  if (ready) break
  await sleep(500)
}
if (!ready) {
  console.error('The film never reported ready.')
  await session.send('Target.closeTarget', { targetId })
  browser.kill()
  process.exit(1)
}

const total = await evaluate('window.__erect3dFilm.frames')
const frames =
  FRAME_SPEC === 'all'
    ? Array.from({ length: Math.ceil(total / STEP) }, (_, index) => index * STEP).filter(frame => frame < total)
    : FRAME_SPEC.split(',').map(value => Number(value.trim())).filter(Number.isFinite)

await mkdir(OUT, { recursive: true })
for (let index = 0; index < frames.length; index += 1) {
  const frame = frames[index]
  await evaluate(`window.__erect3dFilm.renderFrame(${frame})`)
  await sleep(24)
  const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
  const file = join(OUT, `frame-${String(frame).padStart(5, '0')}.png`)
  await writeFile(file, Buffer.from(shot.data, 'base64'))
  if (index % 10 === 0 || index === frames.length - 1) {
    console.log(`captured ${index + 1}/${frames.length} -> ${file}`)
  }
}

console.log(`done: ${frames.length} frames in ${OUT}`)
if (!flag('keep')) {
  await session.send('Target.closeTarget', { targetId }).catch(() => {})
  browser.kill()
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
