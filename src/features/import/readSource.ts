import type { SourceDocument } from '../../domain/types'
import { uid } from '../../domain/types'
import { pngSize, validateImageSize } from './imageSize'

const maxBytes = 200 * 1024 * 1024
const signature = async (file: File) => new Uint8Array(await file.slice(0, 8).arrayBuffer())
export async function readSource(file: File, pageNumber = 1): Promise<{ document: SourceDocument; blob: Blob; pages: number }> {
  if (file.size > maxBytes) throw new Error('The floor plan exceeds the 200 MB local import limit.')
  const bytes = await signature(file)
  const pdf = String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!pdf && !png && !jpeg) throw new Error('Use a valid PNG, JPEG, or PDF floor plan.')
  let blob: Blob = file, pages = 1
  if (pdf) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
    try {
      const pdfDocument = await task.promise
      pages = pdfDocument.numPages
      if (pageNumber < 1 || pageNumber > pages) throw new Error(`This PDF has ${pages} pages.`)
      const page = await pdfDocument.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(3, 3000 / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = globalThis.document.createElement('canvas')
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not rasterize the PDF page.')), 'image/png'))
    } finally { await task.destroy() }
  }
  let width: number, height: number
  if (png) {
    const dimensions = await pngSize(blob)
    validateImageSize(dimensions)
    width = dimensions.width; height = dimensions.height
  } else {
    let bitmap: ImageBitmap
    try { bitmap = await createImageBitmap(blob) } catch { throw new Error('We could not decode this floor-plan image.') }
    width = bitmap.width; height = bitmap.height
    bitmap.close()
    validateImageSize({ width, height })
  }
  if (png) {
    try {
      const scale = Math.min(1, 512 / Math.max(width, height))
      const preview = await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)) })
      preview.close()
    } catch { throw new Error('We could not decode this floor-plan PNG.') }
  }
  return {
    document: {
      id: uid('source'), name: file.name, mime: pdf ? 'application/pdf' : blob.type,
      originalBytes: file.size, width, height,
      page: pdf ? pageNumber : undefined, pages: pdf ? pages : undefined,
    },
    blob, pages,
  }
}
