import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const args = process.argv.slice(2),
  arg = (name, fallback) => {
    const i = args.indexOf(name)
    return i < 0 ? fallback : args[i + 1]
  }
const frames = resolve(arg('--frames', 'output/frames')),
  out = resolve('output/erect3d-film.mp4')
const ffmpeg = arg('--ffmpeg', process.env.FFMPEG_PATH || 'ffmpeg')
if (!existsSync(frames)) throw Error('Capture the film frames first. See README.md.')
for (let n = 0; n < 1050; n++)
  if (!existsSync(join(frames, `frame-${String(n).padStart(5, '0')}.png`)))
    throw Error(`Missing frame ${n}; export requires all 1050 frames.`)
if (readdirSync(frames).filter((f) => /^frame-\d{5}\.png$/.test(f)).length !== 1050)
  throw Error('Expected exactly 1050 numbered PNG frames.')
const first = readFileSync(join(frames, 'frame-00000.png'))
if (
  first.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
  first.readUInt32BE(16) !== 1920 ||
  first.readUInt32BE(20) !== 1080
)
  throw Error('Frames must be actual 1920×1080 PNG images.')
mkdirSync(resolve('output'), { recursive: true })
const result = spawnSync(
  ffmpeg,
  [
    '-y',
    '-framerate',
    '30',
    '-i',
    join(frames, 'frame-%05d.png'),
    '-frames:v',
    '1050',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-vf',
    'scale=out_color_matrix=bt709',
    '-pix_fmt',
    'yuv420p',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit', windowsHide: true },
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
writeFileSync(
  resolve('output/export.json'),
  JSON.stringify(
    {
      file: 'erect3d-film.mp4',
      width: 1920,
      height: 1080,
      fps: 30,
      frames: 1050,
      duration: 35,
      codec: 'H.264',
      crf: 18,
      audio: false,
    },
    null,
    2,
  ),
)
