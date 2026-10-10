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
  if (material === 'standing-seam' || material === 'long-span-metal') {
    const step = material === 'long-span-metal' ? 128 : 64
    for (let x = 0; x < 256; x += step) {
      ctx.fillStyle = '#b4bec0'; ctx.fillRect(x, 0, 3, 256)
      ctx.fillStyle = '#f1f3f2'; ctx.fillRect(x + 3, 0, 2, 256)
      ctx.fillStyle = '#d9dfe0'; ctx.fillRect(x + 5, 0, 8, 256)
    }
  } else if (material === 'corrugated') {
    for (let x = 0; x < 256; x += 32) {
      const gradient = ctx.createLinearGradient(x, 0, x + 32, 0)
      gradient.addColorStop(0, '#bec7c8'); gradient.addColorStop(.35, '#e9eded')
      gradient.addColorStop(.7, '#d5dddd'); gradient.addColorStop(1, '#b7c2c4')
      ctx.fillStyle = gradient; ctx.fillRect(x, 0, 32, 256)
    }
  } else if (material === 'concrete-tile' || material === 'clay-tile' || material === 'stone-coated-metal' || material === 'shingle') {
    const shingle = material === 'shingle'
    const width = shingle ? 29 : 38, height = shingle ? 24 : 32
    for (let row = 0; row < Math.ceil(256 / height); row++) for (let column = -1; column < Math.ceil(256 / width) + 1; column++) {
      const x = column * width + (row % 2) * width / 2, y = row * height
      ctx.fillStyle = material === 'clay-tile' ? row % 2 ? '#ded0c4' : '#eee0d3'
        : material === 'stone-coated-metal' ? row % 2 ? '#c5c4bf' : '#dddcd7'
          : shingle ? row % 2 ? '#c4c5c4' : '#dcddda' : row % 2 ? '#dadbdd' : '#e8e8e7'
      ctx.fillRect(x + 2, y + 2, width - 3, height - 3)
      ctx.strokeStyle = '#9b9f9f'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, width - 2, height - 2)
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 4, y + 4, width - 7, 2)
    }
  } else {
    for (let i = 0; i < 1200; i++) {
      const x = (i * 113) % 256, y = (i * 197) % 256
      ctx.fillStyle = i % 2 ? 'rgba(80,85,85,.06)' : 'rgba(255,255,255,.12)'
      ctx.fillRect(x, y, 1 + i % 3, 1 + i % 2)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8
  cache.set(material, texture)
  return texture
}
