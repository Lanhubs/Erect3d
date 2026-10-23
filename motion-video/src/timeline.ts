import { FILM } from './config'
import { progress, mix } from './motion'
export { FILM, scenes } from './config'
export { progress, mix, envelope } from './motion'
export const editStep = (t: number) => Math.round(progress(t, 25, 26.5) * 10)
export class FilmTimeline {
  time = 0
  playing = false
  private listeners = new Set<() => void>()
  private frame = 0
  private origin = 0
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  snapshot = () => this.time
  seek = (seconds: number) => {
    this.time = Math.min(FILM.duration, Math.max(0, Number.isFinite(seconds) ? seconds : 0))
    this.origin = performance.now() - this.time * 1000
    this.listeners.forEach((fn) => fn())
  }
  play = () => {
    if (this.playing) return
    if (this.time >= FILM.duration) this.seek(0)
    this.playing = true
    this.origin = performance.now() - this.time * 1000
    this.tick()
  }
  pause = () => {
    this.playing = false
    cancelAnimationFrame(this.frame)
    this.listeners.forEach((fn) => fn())
  }
  private tick = () => {
    if (!this.playing) return
    this.seek((performance.now() - this.origin) / 1000)
    if (this.time >= FILM.duration) {
      this.pause()
      return
    }
    this.frame = requestAnimationFrame(this.tick)
  }
  dispose = () => {
    this.pause()
    this.listeners.clear()
  }
}
export function cameraAt(t: number) {
  const keys = [
    { t: 0, p: [6, 28, 5.001], look: [6, 0, 5], fov: 38 },
    { t: 12, p: [6, 28, 5.001], look: [6, 0, 5], fov: 38 },
    { t: 18.8, p: [24, 17, 25], look: [6, 2.3, 5], fov: 38 },
    { t: 23.7, p: [22, 13, 23], look: [6, 2.5, 5], fov: 38 },
    { t: 27.6, p: [20, 11, 24], look: [6, 2.5, 5], fov: 38 },
    { t: 28.7, p: [6, 1.68, 11.6], look: [6, 1.6, 8.8], fov: 64 },
    { t: 30.1, p: [6, 1.68, 9.1], look: [3, 1.6, 9.1], fov: 64 },
    { t: 31.8, p: [4.6, 1.68, 9.1], look: [2, 1.5, 8.8], fov: 64 },
    { t: 32, p: [3.9, 1.68, 9.1], look: [1, 1.5, 8.8], fov: 64 },
    { t: 32.65, p: [24, 16, 27], look: [3, 2.5, 5], fov: 38 },
    { t: 35, p: [23, 15.5, 27], look: [3, 2.5, 5], fov: 38 },
  ]
  const i = keys.findIndex((k) => k.t >= t),
    b = keys[Math.max(1, i < 0 ? keys.length - 1 : i)],
    a = keys[Math.max(0, (i < 0 ? keys.length - 1 : i) - 1)],
    f = progress(t, a.t, b.t)
  return {
    position: a.p.map((n, i) => mix(n, b.p[i], f)) as [number, number, number],
    target: a.look.map((n, i) => mix(n, b.look[i], f)) as [number, number, number],
    fov: mix(a.fov, b.fov, f),
  }
}
