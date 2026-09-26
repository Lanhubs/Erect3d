import { useRef, useState } from 'react'
import type { Point } from '../../domain/types'
import { calibrate, distance } from '../../geometry/math'
import { toDisplay, toMetres, type Unit } from '../../geometry/units'

type Props = { url: string; width: number; height: number; unit: Unit; onSave: (a: Point, b: Point, metres: number) => void }
export function CalibrationPanel({ url, width, height, unit, onSave }: Props) {
  const [points, setPoints] = useState<Point[]>([])
  const [known, setKnown] = useState(() => String(toDisplay(4.5, unit)))
  const [measureUnit, setMeasureUnit] = useState<Unit | 'ft' | 'in'>(unit)
  const [error, setError] = useState('')
  const [view, setView] = useState({ x: 0, z: 0, width, height })
  const pan = useRef<{ clientX: number; clientY: number; view: typeof view } | null>(null)
  return <div className="calibration">
    <div className="calibration-copy"><strong>Calibrate plan scale</strong><span>Click two endpoints of a known dimension on the drawing.</span>
      <label>Known distance <div className="field-row"><input type="number" min=".001" step=".001" value={known} onChange={event => setKnown(event.target.value)} />
        <select aria-label="Known distance unit" value={measureUnit} onChange={event => setMeasureUnit(event.target.value as Unit | 'ft' | 'in')}>
          <option value="m">m</option><option value="cm">cm</option><option value="mm">mm</option>
          <option value="ft">ft</option><option value="in">in</option>
        </select></div></label>
      <div className="calibration-stats"><span>Image distance</span><b>{points.length === 2 ? `${distance(points[0], points[1]).toFixed(1)} px` : 'Select points'}</b>
        <span>Scale</span><b>{points.length === 2 && Number(known) > 0 ? `${(Number(known) / distance(points[0], points[1])).toFixed(5)} ${measureUnit}/px` : '—'}</b></div>
      {error && <p className="error">{error}</p>}
      <button onClick={() => setPoints([])}>Reset points</button>
      <button onClick={() => setView({ x: 0, z: 0, width, height })}>Fit image</button>
      <button className="primary" disabled={points.length !== 2} onClick={() => {
        try { const value = Number(known)
          const metres = measureUnit === 'ft' ? value * .3048 : measureUnit === 'in' ? value * .0254 : toMetres(value, measureUnit)
          calibrate(points[0], points[1], metres); onSave(points[0], points[1], metres) } catch (cause) { setError((cause as Error).message) }
      }}>Apply scale</button>
    </div>
    <svg className="calibration-image" viewBox={`${view.x} ${view.z} ${view.width} ${view.height}`}
      onPointerDown={event => { if (event.button === 1) { pan.current = { clientX: event.clientX, clientY: event.clientY, view }; event.currentTarget.setPointerCapture(event.pointerId) } }}
      onPointerMove={event => { if (!pan.current) return; const start = pan.current; const scale = Math.max(start.view.width / event.currentTarget.clientWidth, start.view.height / event.currentTarget.clientHeight)
        setView({ ...start.view, x: start.view.x - (event.clientX - start.clientX) * scale, z: start.view.z - (event.clientY - start.clientY) * scale }) }}
      onPointerUp={() => { pan.current = null }} onClick={event => {
      if (event.button !== 0) return
      const svg = event.currentTarget, p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
      const q = p.matrixTransform(svg.getScreenCTM()!.inverse())
      setPoints(previous => previous.length === 2 ? [{ x: q.x, z: q.y }] : [...previous, { x: q.x, z: q.y }])
    }} onWheel={event => {
      event.preventDefault()
      const factor = Math.exp(event.deltaY * .001)
      const svg = event.currentTarget, p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
      const q = p.matrixTransform(svg.getScreenCTM()!.inverse())
      setView(current => ({ x: q.x + (current.x - q.x) * factor, z: q.y + (current.z - q.y) * factor, width: current.width * factor, height: current.height * factor }))
    }}>
      <image href={url} width={width} height={height} />
      {points.length === 2 && <line x1={points[0].x} y1={points[0].z} x2={points[1].x} y2={points[1].z} stroke="#b2763d" strokeWidth={Math.max(width, height) * .003} />}
      {points.map((point, i) => <circle key={i} cx={point.x} cy={point.z} r={Math.max(width, height) * .006} fill="#b2763d" stroke="white" strokeWidth={Math.max(width, height) * .002} />)}
    </svg>
  </div>
}
