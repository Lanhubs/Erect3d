export const rasterMimes = ['image/png', 'image/jpeg'] as const
export const cadMimes = ['image/vnd.dwg', 'image/vnd.dxf'] as const
export const pdfMime = 'application/pdf'
export const sourceMimes = [...rasterMimes, pdfMime, ...cadMimes] as const
export type SourceMime = (typeof sourceMimes)[number]
export type CadMime = (typeof cadMimes)[number]

export function isRasterMime(mime: string): boolean {
  return (rasterMimes as readonly string[]).includes(mime)
}
export function isCadMime(mime: string): mime is CadMime {
  return (cadMimes as readonly string[]).includes(mime)
}
export function isPdfMime(mime: string): boolean {
  return mime === pdfMime
}
export function isSourceMime(mime: string): mime is SourceMime {
  return (sourceMimes as readonly string[]).includes(mime)
}
