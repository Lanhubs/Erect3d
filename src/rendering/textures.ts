import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { MaterialKey } from '../domain/types'

const textures = new Map<MaterialKey, CanvasTexture>()
function pattern(key: MaterialKey): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 256
  const context = canvas.getContext('2d')!
  const base = key === 'tile' ? '#d4d0c5' : key === 'oak' ? '#ac8d69' : key === 'timber' ? '#8e7558'
    : key === 'marble' ? '#e4e2dc' : key === 'carpet' ? '#92988b' : key === 'polished-concrete' ? '#aaa9a6'
      : key === 'concrete' ? '#aaa9a2' : '#cbc6ba'
  context.fillStyle = base
  context.fillRect(0, 0, 256, 256)
  if (key === 'tile') {
    context.strokeStyle = '#b2afa5'; context.lineWidth = 3
    context.strokeRect(1.5, 1.5, 253, 253)
    context.strokeStyle = 'rgba(255,255,255,.25)'; context.lineWidth = 2
    context.strokeRect(5, 5, 246, 246)
  } else if (key === 'marble') {
    context.strokeStyle = 'rgba(99,104,100,.22)'; context.lineWidth = 2
    for (let i = 0; i < 7; i++) {
      context.beginPath(); context.moveTo(-20, i * 51)
      context.bezierCurveTo(75, i * 51 - 30, 150, i * 51 + 45, 276, i * 51 - 10)
      context.stroke()
    }
  } else if (key === 'carpet') {
    for (let i = 0; i < 950; i++) {
      const x = (i * 137) % 256, y = (i * 83) % 256
      context.fillStyle = i % 3 ? 'rgba(255,255,255,.045)' : 'rgba(20,30,20,.08)'
      context.fillRect(x, y, 2, 2)
    }
  } else if (key === 'oak' || key === 'timber') {
    context.strokeStyle = 'rgba(57,42,29,.27)'; context.lineWidth = 2
    for (const x of [0, 64, 128, 192, 255]) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 256); context.stroke() }
    for (let row = 0; row < 4; row++) {
      const x = row % 2 ? 180 : 70
      context.beginPath(); context.moveTo(row * 64, x); context.lineTo((row + 1) * 64, x); context.stroke()
    }
    for (let i = 0; i < 90; i++) {
      const x = (i * 73) % 256, y = (i * 151) % 256
      context.strokeStyle = i % 2 ? 'rgba(255,245,215,.12)' : 'rgba(58,40,23,.08)'
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + 20, y + 3); context.stroke()
    }
  } else {
    for (let i = 0; i < 300; i++) {
      const x = (i * 131) % 256, y = (i * 79) % 256
      context.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(30,30,30,.03)'
      context.fillRect(x, y, 2, 2)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  texture.generateMipmaps = true
  texture.repeat.set(key === 'tile' ? 1.6 : 1, key === 'tile' ? 1.6 : 1)
  return texture
}
export function floorTexture(key: MaterialKey): CanvasTexture {
  let texture = textures.get(key)
  if (!texture) { texture = pattern(key); textures.set(key, texture) }
  return texture
}
