import { useMemo, useState } from 'react'
import type { Level } from '../../domain/types'
import { levelQuantities } from '../../geometry/quantities'
import { formatArea, formatDistance, type Unit } from '../../geometry/units'

export function AnalysisPanel({ level, unit }: { level: Level; unit: Unit }) {
  const quantities = useMemo(() => levelQuantities(level), [level])
  const [waste, setWaste] = useState(10)
  return <section className="analysis-panel">
    <header><span>ANALYZE</span><h1>{level.name}</h1><p>Quantities calculated from the editable model.</p></header>
    <div className="analysis-grid">
      <article><h2>Building</h2><dl>
        <dt>Walls</dt><dd>{quantities.walls}</dd><dt>Doors</dt><dd>{quantities.doors}</dd>
        <dt>Windows</dt><dd>{quantities.windows}</dd><dt>Rooms</dt><dd>{quantities.rooms}</dd>
        <dt>Total wall length</dt><dd>{formatDistance(quantities.wallLength, unit)}</dd>
      </dl></article>
      <article><h2>Surfaces</h2><dl>
        <dt>Room floor area</dt><dd>{formatArea(quantities.floorArea, unit)}</dd>
        <dt>Wall finish, both sides</dt><dd>{formatArea(quantities.wallFinishArea, unit)}</dd>
        <dt>Roof covering</dt><dd>{formatArea(quantities.roofArea, unit)}</dd>
      </dl>{!quantities.rooms && <p>Add room polygons to calculate floor finish area.</p>}</article>
      <article><h2>Floor finishes</h2><dl>
        {quantities.floorByMaterial.map(item => <div className="analysis-line" key={item.material}>
          <dt>{item.material}</dt><dd>{formatArea(item.area, unit)}</dd>
        </div>)}
      </dl>{!quantities.floorByMaterial.length && <p>No room finishes assigned.</p>}</article>
      <article><h2>Material allowance</h2>
        <label>Waste allowance <select aria-label="Waste allowance" value={waste} onChange={event => setWaste(Number(event.target.value))}>
          {[0, 5, 10, 15, 20].map(value => <option key={value} value={value}>{value}%</option>)}
        </select></label>
        <dl><dt>Flooring required</dt><dd>{formatArea(quantities.floorArea * (1 + waste / 100), unit)}</dd>
          <dt>Roofing required</dt><dd>{formatArea(quantities.roofArea * (1 + waste / 100), unit)}</dd></dl>
        <p>Area estimates from current geometry. Openings are deducted from wall finish.</p>
      </article>
    </div>
  </section>
}
