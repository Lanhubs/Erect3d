import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { MaterialKey } from '../domain/types'

const cache = new Map<MaterialKey, CanvasTexture>()

export function wallTexture(material: MaterialKey) {
  const cached = cache.get(material)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f7f5'; ctx.fillRect(0, 0, 256, 256)
  if (material === 'brick') {
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const x = col * 70 + (row % 2) * 35, y = row * 32
      ctx.fillStyle = row % 2 ? '#eeebe7' : '#faf8f4'; ctx.fillRect(x + 3, y + 3, 65, 27)
      ctx.strokeStyle = '#c6c0b8'; ctx.lineWidth = 3; ctx.strokeRect(x + 1, y + 1, 68, 30)
    }
  } else if (material === 'timber' || material === 'oak') {
    for (let x = 0; x < 256; x += 42) {
      ctx.strokeStyle = '#c5bfb5'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke()
      ctx.strokeStyle = 'rgba(120,104,90,.1)'; ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * 7, 0); ctx.bezierCurveTo(x + 14 + i * 6, 80, x + 3 + i * 7, 170, x + 8 + i * 7, 256); ctx.stroke() }
    }
  } else if (material === 'tile') {
    ctx.strokeStyle = '#d0ceca'; ctx.lineWidth = 3
    for (const n of [0, 128, 255]) { ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(256, n); ctx.stroke() }
  } else {
    for (let i = 0; i < 1400; i++) {
      const x = (i * 181) % 256, y = (i * 97) % 256
      ctx.fillStyle = i % 3 ? 'rgba(91,93,91,.035)' : 'rgba(255,255,255,.1)'
      ctx.fillRect(x, y, 1 + i % 3, 1 + i % 2)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8
  cache.set(material, texture)
  return texture
}
