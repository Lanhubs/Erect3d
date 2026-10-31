import type { CadMime } from '../../domain/sourceMime'

export type CadFormat = 'dwg' | 'dxf'
export type CadSniff = { format?: CadFormat; binary: boolean }

const extensions: Record<string, CadFormat> = { dwg: 'dwg', dxf: 'dxf' }
const dwgVersion = /^AC10\d{2}/
const binarySentinel = /^AutoCAD Binary DXF/
const controlBytes = /^[^ -~]{0,4}/
const sectionMarker = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*SECTION/
const dxfMarkers = ['$ACADVER', 'ENDSEC', 'ENTITIES', 'BLOCKS', 'OBJECTS']
const headerBytes = 4096

export const cadAccept = '.dwg,.dxf,image/vnd.dwg,image/vnd.dxf'
export const binaryDxfMessage =
  'AutoCAD Binary DXF is not supported. Save the drawing as ASCII DXF or DWG and import it again.'

export function cadExtension(name: string): CadFormat | undefined {
  const lower = name.toLowerCase(),
    dot = lower.lastIndexOf('.')
  return dot < 0 ? undefined : extensions[lower.slice(dot + 1)]
}

export const cadMimeFor = (format: CadFormat): CadMime =>
  format === 'dwg' ? 'image/vnd.dwg' : 'image/vnd.dxf'

export function cadFormatFromMime(mime: string): CadFormat | undefined {
  return mime === 'image/vnd.dwg' ? 'dwg' : mime === 'image/vnd.dxf' ? 'dxf' : undefined
}

// Binary DXF repeats the DWG version stamp, then control bytes, before its sentinel.
const isBinary = (text: string) =>
  binarySentinel.test(text) || binarySentinel.test(text.replace(dwgVersion, '').replace(controlBytes, ''))

// Only the leading kilobytes are read: DWG carries a version stamp and DXF is text.
function classify(bytes: Uint8Array): CadSniff {
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, headerBytes)))
    .replace(/^\uFEFF/, '')
  if (isBinary(text)) return { binary: true }
  if (dwgVersion.test(text)) return { format: 'dwg', binary: false }
  const ascii =
    !text.includes('\0') && (sectionMarker.test(text) || dxfMarkers.some((marker) => text.includes(marker)))
  return { format: ascii ? 'dxf' : undefined, binary: false }
}

export async function sniffCadFile(file: File): Promise<CadSniff> {
  if (!file.size) return { binary: false }
  return classify(new Uint8Array(await file.slice(0, headerBytes).arrayBuffer()))
}

/** Named or declared as CAD, and not a binary DXF. The server re-validates the header. */
export async function detectCadFile(file: File): Promise<CadFormat | undefined> {
  const named = cadExtension(file.name) || cadFormatFromMime(file.type)
  if (!named) return undefined
  const sniffed = await sniffCadFile(file)
  if (sniffed.binary) throw new Error(binaryDxfMessage)
  return sniffed.format || named
}
