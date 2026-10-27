// A detection-only mask. Original files and provider images remain byte-identical.
// Broad colour fills are not wall bands; narrow coloured strokes remain evidence.
export function neutralInk(data: Uint8Array, width: number, height: number) {
  const span = Math.max(12, Math.ceil(Math.min(width, height) * 0.02))
  const broad = new Uint8Array(width * height)
  let hasBroad = false
  const colourful = (index: number) => {
    const at = index * 4,
      alpha = data[at + 3] / 255
    const high = Math.max(data[at], data[at + 1], data[at + 2]),
      low = Math.min(data[at], data[at + 1], data[at + 2])
    return (high - low) * alpha >= 50 && high * alpha + 255 * (1 - alpha) >= 90
  }
  for (let y = 0; y < height; y++) {
    let start = 0
    for (let x = 0; x <= width; x++) {
      if (x < width && colourful(y * width + x)) continue
      if (x - start >= span) {
        broad.fill(1, y * width + start, y * width + x)
        hasBroad = true
      }
      start = x + 1
    }
  }
  if (!hasBroad)
    return { pixels: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), suppressed: 0 }
  let pixels: Uint8ClampedArray | undefined,
    suppressed = 0
  for (let x = 0; x < width; x++) {
    let start = 0
    for (let y = 0; y <= height; y++) {
      if (y < height && colourful(y * width + x)) continue
      if (y - start >= span)
        for (let row = start; row < y; row++) {
          const index = row * width + x
          if (!broad[index]) continue
          pixels ||= new Uint8ClampedArray(data)
          pixels.fill(255, index * 4, index * 4 + 4)
          suppressed++
        }
      start = y + 1
    }
  }
  return {
    pixels: pixels || new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    suppressed,
  }
}
