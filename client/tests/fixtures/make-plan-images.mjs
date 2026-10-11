import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const table = Array.from({ length: 256 }, (_, n) => {
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
function crc(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
function chunk(name, data) {
  const label = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([label, data])))
  return Buffer.concat([size, label, data, checksum])
}
function writePlan(name, width, height) {
  const stride = width + 1, pixels = Buffer.alloc(stride * height, 255)
  for (let y = 0; y < height; y++) pixels[y * stride] = 0
  const draw = (x, y) => { pixels[y * stride + 1 + x] = 35 }
  const x0 = Math.round(width * .05), x1 = Math.round(width * .95)
  const y0 = Math.round(height * .1), y1 = Math.round(height * .9)
  const mid = Math.round((x0 + x1) / 2), thick = width > 1000 ? 12 : 2
  for (let t = 0; t < thick; t++) {
    for (let x = x0; x < x1; x++) { draw(x, y0 + t); draw(x, y1 - t) }
    for (let y = y0; y <= y1; y++) { draw(x0 + t, y); draw(x1 - t, y) }
    for (let y = y0; y <= y1; y++) draw(mid + t, y)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4)
  header[8] = 8; header[9] = 0
  writeFileSync(new URL(name, import.meta.url), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]))
}

writePlan('./large-plan.png', 13_000, 800)
writePlan('./small-plan.png', 205, 180)
