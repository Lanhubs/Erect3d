import sharp from 'sharp'
import { createRequire } from 'node:module'
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import { bytesHash } from '../modules/assets/validation'
import type { SourceText, SourceLabel } from '../contracts/source-text'
import { textLines, combineTextLines } from './text-lines'
import { textDeadline, textTileOffsets } from './text-limits'

const require = createRequire(import.meta.url)
const language: { langPath: string } = require('@tesseract.js-data/eng')
const cache = new Map<string, SourceText>()
let queue: Promise<unknown> = Promise.resolve()
const result = (status: SourceText['status'], items: SourceLabel[], warnings: string[] = []): SourceText => ({
  version: 1,
  engine: 'tesseract-local',
  status,
  items,
  warnings,
})

async function recognize(bytes: Uint8Array, signal: AbortSignal): Promise<SourceText> {
  let worker: Worker | undefined
  const lines: SourceLabel[] = []
  try {
    signal.throwIfAborted()
    const image = sharp(bytes, { limitInputPixels: 100_000_000 }),
      metadata = await image.metadata()
    const width = metadata.width!,
      height = metadata.height!
    if ((await image.clone().stats()).channels.every((channel) => channel.stdev < 1))
      return result('ready', [])
    const initializing = createWorker('eng', OEM.LSTM_ONLY, {
      langPath: language.langPath,
      gzip: true,
      cacheMethod: 'none',
      errorHandler: () => {},
    })
    void initializing
      .then((value) => {
        if (signal.aborted) void value.terminate()
      })
      .catch(() => {})
    worker = await textDeadline(initializing, signal)
    signal.throwIfAborted()
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: '300' })
    // Small printed labels get a larger OCR working copy. The uploaded/provider
    // image is never replaced, recompressed or resized.
    const scale = width * height < 2_000_000 ? 1.5 : 1
    const edge = width * height <= 6_000_000 ? Math.max(width, height) : 2048
    for (const top of textTileOffsets(height, edge)) {
      for (const left of textTileOffsets(width, edge)) {
        signal.throwIfAborted()
        const w = Math.min(edge, width - left),
          h = Math.min(edge, height - top)
        const renderedWidth = Math.round(w * scale),
          renderedHeight = Math.round(h * scale)
        const view = image
          .clone()
          .extract({ left, top, width: w, height: h })
          .resize(renderedWidth, renderedHeight)
          .grayscale()
          .normalize()
        const process = async (binary: boolean) => {
          const pixels = await (binary ? view.clone().threshold(165) : view.clone().sharpen())
            .png()
            .toBuffer()
          const { data } = await textDeadline(
            worker!.recognize(pixels, {}, { blocks: true, text: false }),
            signal,
          )
          return textLines(data.blocks, renderedWidth, renderedHeight).map((line) => ({
            ...line,
            bounds: {
              x: (left + line.bounds.x * w) / width,
              y: (top + line.bounds.y * h) / height,
              width: (line.bounds.width * w) / width,
              height: (line.bounds.height * h) / height,
            },
          }))
        }
        const first = await process(false)
        lines.push(...first)
        if (first.length < 3 || first.filter((line) => line.confidence < 0.7).length >= 3) {
          signal.throwIfAborted()
          lines.push(...(await process(true)))
        }
      }
    }
    const combined = combineTextLines(lines)
    return result(
      combined.length > 300 ? 'partial' : 'ready',
      combined.slice(0, 300),
      combined.length > 300
        ? [
            'This sheet exceeds the local text inventory budget. Additional source labels require review; coverage is incomplete.',
          ]
        : [],
    )
  } catch {
    return result(lines.length ? 'partial' : 'unavailable', combineTextLines(lines).slice(0, 300), [
      'Local text reading was incomplete. Review unclear labels against the original drawing; missing text was not guessed.',
    ])
  } finally {
    await worker?.terminate().catch(() => {})
  }
}
export async function readSourceText(bytes: Uint8Array, parent?: AbortSignal): Promise<SourceText> {
  parent?.throwIfAborted()
  const key = bytesHash(bytes),
    saved = cache.get(key)
  if (saved) return structuredClone(saved)
  const signal = AbortSignal.any([AbortSignal.timeout(20000), ...(parent ? [parent] : [])])
  let started = false
  const task = queue.then(async () => {
    signal.throwIfAborted()
    started = true
    // One OCR worker at a time per API/worker process bounds WASM memory.
    return recognize(bytes, signal)
  })
  queue = task.catch(() => {})
  const value = await textDeadline(task, signal).catch(() =>
    started ? task : result('unavailable', [], ['Text reading timed out or was cancelled.']),
  )
  parent?.throwIfAborted()
  if (value.status === 'ready') {
    if (cache.size >= 8) cache.delete(cache.keys().next().value!)
    cache.set(key, structuredClone(value))
  }
  return value
}
