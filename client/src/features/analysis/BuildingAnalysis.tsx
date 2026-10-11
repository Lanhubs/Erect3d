import { useMemo, useState } from 'react'
import type { Building, Level } from '../../domain/types'
import { buildingQuantities } from '../../geometry/quantities'
import { formatArea, type Unit } from '../../geometry/units'
import { AnalysisPanel } from './AnalysisPanel'

export function BuildingAnalysis({ building, active, unit }: { building: Building; active: Level; unit: Unit }) {
  const [scope, setScope] = useState<'building' | 'level'>('building')
  const totals = useMemo(() => buildingQuantities(building), [building])
  return <section className="building-analysis">
    <div className="analysis-scope"><button aria-pressed={scope === 'building'} onClick={() => setScope('building')}>Building</button>
      <button aria-pressed={scope === 'level'} onClick={() => setScope('level')}>{active.name}</button></div>
    {scope === 'level' ? <AnalysisPanel level={active} unit={unit} /> : <div className="analysis-panel">
      <header><span>ANALYZE</span><h1>{building.name}</h1><p>Quantities from all editable levels.</p></header>
      <div className="analysis-grid"><article><h2>Building totals</h2><dl>
        <dt>Room floor area</dt><dd>{formatArea(totals.floorArea, unit)}</dd>
        <dt>Net slab area</dt><dd>{formatArea(totals.slabArea, unit)}</dd>
        <dt>Wall finish</dt><dd>{formatArea(totals.wallFinishArea, unit)}</dd>
        <dt>Roof covering</dt><dd>{formatArea(totals.roofArea, unit)}</dd>
        <dt>Rooms</dt><dd>{totals.rooms}</dd><dt>Doors</dt><dd>{totals.doors}</dd><dt>Windows</dt><dd>{totals.windows}</dd>
        <dt>Stairs</dt><dd>{totals.stairs}</dd><dt>Columns</dt><dd>{totals.columns}</dd>
      </dl></article><article><h2>By level</h2><dl>{totals.byLevel.map(({ level, quantities }) => <div className="analysis-line" key={level.id}>
        <dt>{level.name} · {level.elevation.toFixed(2)} m</dt><dd>{formatArea(quantities.floorArea, unit)} rooms · {formatArea(quantities.slabArea, unit)} slab</dd>
      </div>)}</dl></article></div>
    </div>}
  </section>
}
