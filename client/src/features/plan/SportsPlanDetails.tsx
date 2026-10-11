import type { Room } from '../../domain/types'

export function SportsPlanDetails({ room }: { room: Room }) {
  if (room.category !== 'football-pitch' && room.category !== 'table-tennis-hall') return null
  const xs = room.polygon.map(point => point.x), zs = room.polygon.map(point => point.z)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
  const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2, width = x1 - x0, depth = z1 - z0
  if (room.category === 'football-pitch') return <g pointerEvents="none" fill="none" stroke="#eff5e9" strokeWidth=".12">
    <rect x={x0} y={z0} width={width} height={depth} />
    <line x1={midX} y1={z0} x2={midX} y2={z1} />
    <circle cx={midX} cy={midZ} r="9.15" />
    <circle cx={midX} cy={midZ} r=".15" fill="#eff5e9" />
    <rect x={x0} y={midZ - 20.16} width="16.5" height="40.32" />
    <rect x={x1 - 16.5} y={midZ - 20.16} width="16.5" height="40.32" />
    <rect x={x0} y={midZ - 9.16} width="5.5" height="18.32" />
    <rect x={x1 - 5.5} y={midZ - 9.16} width="5.5" height="18.32" />
    <line x1={x0 - 2.3} y1={midZ - 3.66} x2={x0 - 2.3} y2={midZ + 3.66} stroke="#536778" strokeWidth=".28" />
    <line x1={x1 + 2.3} y1={midZ - 3.66} x2={x1 + 2.3} y2={midZ + 3.66} stroke="#536778" strokeWidth=".28" />
  </g>
  return <g pointerEvents="none">
    {[midX - width * .24, midX, midX + width * .24].map(x => <g key={x}>
      <rect x={x - 2.9} y={midZ - 1.7} width="5.8" height="3.4" fill="none" stroke="#f5f2e7" strokeWidth=".08" />
      <rect x={x - 1.37} y={midZ - .7625} width="2.74" height="1.525" fill="#296b75" stroke="#e8ece7" strokeWidth=".05" />
      <line x1={x} y1={midZ - .7625} x2={x} y2={midZ + .7625} stroke="#f5f2e7" strokeWidth=".04" />
    </g>)}
  </g>
}
