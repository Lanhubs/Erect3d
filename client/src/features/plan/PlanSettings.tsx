import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GridSettings } from '../../state/project'
import { toDisplay, toMetres, type Unit } from '../../geometry/units'
import {useOverlay} from '../../app/useOverlay'

export function PlanSettings({ grid, setGrid, unit }: {
  grid: GridSettings; setGrid: (change: Partial<GridSettings>) => void; unit: Unit
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useOverlay(panel,open,()=>setOpen(false),true,false)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      if (!anchor) return
      const width = Math.min(250, window.innerWidth - 16)
      const height = panel.current?.getBoundingClientRect().height || 260
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, anchor.right - width))
      const top = anchor.bottom + 6 + height <= window.innerHeight - 8
        ? anchor.bottom + 6 : Math.max(8, anchor.top - height - 6)
      setPosition({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    let timer:ReturnType<typeof setTimeout>|undefined,keyboard=false
    const within=(target:EventTarget|null)=>target instanceof Node&&Boolean(panel.current?.contains(target)||trigger.current?.contains(target))
    const closeOutside = (event: PointerEvent) => {
      keyboard=false
      const target = event.target as Node
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false)
    }
    const key=()=>{keyboard=true}
    const enter=(event:PointerEvent)=>{if(within(event.target))clearTimeout(timer)}
    const leave=(event:PointerEvent)=>{
      if(event.pointerType!=='mouse'||!within(event.target)||within(event.relatedTarget))return
      clearTimeout(timer)
      timer=setTimeout(()=>{
        const active=document.activeElement,editing=active instanceof Element&&active.matches('input:not([type=checkbox]):not([type=radio]),select,textarea')
        if(!((keyboard||editing)&&within(active)))setOpen(false)
      },200)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown',key,true);document.addEventListener('pointerover',enter);document.addEventListener('pointerout',leave)
    return () => {clearTimeout(timer);document.removeEventListener('pointerdown', closeOutside);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerover',enter);document.removeEventListener('pointerout',leave)}
  }, [open])
  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(value => !value)}>Grid &amp; snap ▾</button>
    {open && createPortal(<div ref={panel} className="plan-settings-panel" role="dialog" aria-label="Grid and snap settings"
      style={{ top: position.top, left: position.left }}>
      <label><input type="checkbox" checked={grid.visible} onChange={event => setGrid({ visible: event.target.checked })} /> Show grid</label>
      <label><input type="checkbox" checked={grid.snap} onChange={event => setGrid({ snap: event.target.checked })} /> Snap to grid</label>
      <label>Grid interval
        <select aria-label="Grid interval" value={grid.step} onChange={event => setGrid({ step: Number(event.target.value) })}>
          <option value="0.1">100 mm</option><option value="0.25">250 mm</option><option value="0.5">500 mm</option><option value="1">1 m</option>
        </select>
      </label>
      <label>Angle snap
        <select aria-label="Angle snap" value={grid.angle} onChange={event => setGrid({ angle: Number(event.target.value) })}>
          <option value="0">Off</option><option value="15">15°</option><option value="30">30°</option>
          <option value="45">45°</option><option value="90">90°</option>
        </select>
      </label>
      <label>Fixed length · {unit}
        <input type="number" min="0" step={unit === 'm' ? '.1' : '1'} value={toDisplay(grid.length, unit)}
          onChange={event => setGrid({ length: Math.max(0, toMetres(Number(event.target.value), unit)) })} />
      </label>
      <small>Zero turns fixed length off. Hold Shift to draw without snapping.</small>
    </div>, document.body)}
  </>
}
