import type { AnalysisInput,Intelligence } from '../../contracts/analysis'
export function reconstructionScale(input:AnalysisInput,proposal:Intelligence,width:number,height:number) {
  const result=structuredClone(input),evidence=proposal.understanding?.scale
  if (input.options.purpose!=='rebuild' || input.calibration.method==='manual' || !evidence) return result
  const pixels=Math.hypot((evidence.b.x-evidence.a.x)*width,(evidence.b.y-evidence.a.y)*height)
  const metresPerPixel=evidence.knownMetres/pixels
  if (pixels<2 || !Number.isFinite(metresPerPixel) || metresPerPixel<.00001 || metresPerPixel>10) return result
  result.calibration={a:{x:0,z:0},b:{x:pixels,z:0},knownMetres:evidence.knownMetres,
    metresPerPixel,method:'auto',basisPixels:pixels}
  return result
}
