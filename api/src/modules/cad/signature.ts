export type CadFormat = 'dwg' | 'dxf'
const dwgVersion = /^AC10\d{2}/
const sectionMarker = /(?:^|\r?\n)[ \t]*0[ \t]*\r?\n[ \t]*SECTION/
const dxfMarkers = ['$ACADVER', 'ENDSEC', 'ENTITIES', 'BLOCKS', 'OBJECTS']
const binaryDxf = /^AutoCAD Binary DXF/
const controlBytes = /^[^ -~]{0,4}/
const byteOrderMark = /^\uFEFF/

function head(bytes: Uint8Array) {
  // CAD interchange is text or a short version stamp, so a bounded prefix is enough to classify.
  const prefix = new TextDecoder('utf-8', { fatal: false }).decode(
    bytes.subarray(0, Math.min(bytes.length, 4096)),
  )
  return prefix.replace(byteOrderMark, '')
}

// Binary DXF carries the same version stamp as DWG, then control bytes before its sentinel.
export function isBinaryDxf(bytes: Uint8Array) {
  const text = head(bytes)
  return binaryDxf.test(text) || binaryDxf.test(text.replace(dwgVersion, '').replace(controlBytes, ''))
}

export function sniffCadFormat(bytes: Uint8Array): CadFormat | null {
  if (!bytes.length) return null
  const text = head(bytes)
  if (isBinaryDxf(bytes)) return null
  if (dwgVersion.test(text)) return 'dwg'
  const ascii =
    !text.includes('\0') && (sectionMarker.test(text) || dxfMarkers.some((marker) => text.includes(marker)))
  return ascii ? 'dxf' : null
}

export const cadMimeFor = (format: CadFormat) => (format === 'dwg' ? 'image/vnd.dwg' : 'image/vnd.dxf')

export function cadMimeToFormat(mime: string): CadFormat | null {
  if (mime === 'image/vnd.dwg') return 'dwg'
  if (mime === 'image/vnd.dxf') return 'dxf'
  return null
}
