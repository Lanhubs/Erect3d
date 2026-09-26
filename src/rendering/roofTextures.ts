import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { RoofMaterial } from '../domain/types'

const cache = new Map<RoofMaterial, CanvasTexture>()

export function roofTexture(material: RoofMaterial) {
  const cached = cache.get(material)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = material === 'concrete' ? '#e5e4e1' : '#e7e9e9'
  ctx.fillRect(0, 0, 256, 256)
  if (material === 'standing-seam') {
    for (let x = 0; x < 256; x += 64) {
      ctx.fillStyle = '#a4aeb0'; ctx.fillRect(x, 0, 4, 256)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, 0, 2, 256)
      ctx.fillStyle = '#d1d7d8'; ctx.fillRect(x + 6, 0, 7, 256)
    }
  } else if (material === 'corrugated') {
    for (let x = 0; x < 256; x += 18) {
      const gradient = ctx.createLinearGradient(x, 0, x + 18, 0)
      gradient.addColorStop(0, '#a7b0b3'); gradient.addColorStop(.35, '#f7f8f8')
      gradient.addColorStop(.7, '#d0d8d9'); gradient.addColorStop(1, '#9ea9ac')
      ctx.fillStyle = gradient; ctx.fillRect(x, 0, 18, 256)
    }
  } else if (material === 'concrete-tile') {
    for (let row = 0; row < 8; row++) for (let column = -1; column < 9; column++) {
      const x = column * 38 + (row % 2) * 19, y = row * 32
      ctx.fillStyle = row % 2 ? '#dadbdd' : '#e8e8e7'
      ctx.fillRect(x + 2, y + 2, 35, 29)
      ctx.strokeStyle = '#9b9f9f'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 36, 30)
      ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(x + 4, y + 4, 30, 2)
    }
  } else {
    for (let i = 0; i < 1200; i++) {
      const x = (i * 113) % 256, y = (i * 197) % 256
      ctx.fillStyle = i % 2 ? 'rgba(80,85,85,.06)' : 'rgba(255,255,255,.12)'
      ctx.fillRect(x, y, 1 + i % 3, 1 + i % 2)
    }
    ctx.strokeStyle = 'rgba(90,95,95,.1)'; ctx.lineWidth = 2
    ctx.strokeRect(0, 0, 255, 255)
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8
  cache.set(material, texture)
  return texture
}
