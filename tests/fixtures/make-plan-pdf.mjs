import { writeFileSync } from 'node:fs'

const drawingA = '0 0 0 RG 8 w 50 50 500 300 re S 250 50 m 250 350 l S 250 190 m 550 190 l S'
const drawingB = '0 0 0 RG 10 w 45 45 510 310 re S 210 45 m 210 355 l S 390 45 m 390 355 l S 45 200 m 555 200 l S'
const stream = content => `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << >> /Contents 4 0 R >>',
  stream(drawingA),
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << >> /Contents 6 0 R >>',
  stream(drawingB),
]
let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
const offsets = [0]
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(output, 'latin1'))
  output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
}
const xref = Buffer.byteLength(output, 'latin1')
output += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`
output += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
writeFileSync(new URL('./plan.pdf', import.meta.url), Buffer.from(output, 'latin1'))
