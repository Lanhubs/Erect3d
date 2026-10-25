import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FiLayers, FiUpload, FiGrid, FiFeather, FiBox, FiSliders } from 'react-icons/fi'
import { useOverlay } from './useOverlay'
export const panels = [
  {
    id: 'levels',
    label: 'Levels',
    icon: FiLayers,
    keywords: 'floor elevation duplicate underlay isolate linked storeys',
  },
  {
    id: 'source',
    label: 'Source & reconstruction',
    icon: FiUpload,
    keywords: 'import replace image pdf scale calibrate reconstruct review detection progress',
  },
  {
    id: 'structure',
    label: 'Structure',
    icon: FiGrid,
    keywords: 'slab column stairs ramp shaft opening void',
  },
  {
    id: 'details',
    label: 'Architectural details',
    icon: FiFeather,
    keywords: 'railing screen fin canopy parapet pergola arch',
  },
  {
    id: 'furniture',
    label: 'Furniture',
    icon: FiBox,
    keywords: 'bed sofa chair desk table fixture toilet sink cabinet',
  },
  {
    id: 'properties',
    label: 'Properties',
    icon: FiSliders,
    keywords: 'wall door window room roof fence height width material glazing pitch color systems',
  },
] as const
export type PanelId = (typeof panels)[number]['id']
export function PanelRail({
  active,
  open,
  levelName,
  warning,
}: {
  active: PanelId | null
  open: (panel: PanelId) => void
  levelName: string
  warning?: boolean
}) {
  return (
    <nav className="panel-rail" aria-label="Building panels">
      {panels.map((panel) => (
        <button
          key={panel.id}
          data-tooltip={`${panel.label}${panel.id === 'levels' ? ` · ${levelName}` : ''}`}
          aria-label={panel.label}
          aria-pressed={active === panel.id}
          onClick={() => open(panel.id)}
        >
          <panel.icon />
          <span>{panel.id === 'source' ? 'Source' : panel.id === 'details' ? 'Details' : panel.label}</span>
          {warning && panel.id === 'source' && <i aria-label="Source needs attention" />}
        </button>
      ))}
    </nav>
  )
}
export function PanelDrawer({
  active,
  pinned,
  pin,
  close,
  children,
  open,
}: {
  active: PanelId | null
  pinned: boolean
  pin: () => void
  close: () => void
  children: ReactNode
  open: (id: PanelId) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [sheet, setSheet] = useState(() => window.matchMedia('(max-width:700px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width:700px)'),
      change = () => setSheet(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useOverlay(ref, Boolean(active) && (!pinned || sheet), close, sheet, sheet)
  return (
    <aside
      ref={ref}
      hidden={!active}
      role={sheet ? 'dialog' : undefined}
      aria-modal={sheet || undefined}
      className={`workspace-drawer${pinned ? ' pinned' : ''}${active === 'properties' ? ' side-right' : ''}`}
      aria-label={panels.find((p) => p.id === active)?.label || 'Building panel'}
    >
      <header>
        <select
          aria-label="Panel"
          value={active || 'levels'}
          onChange={(event) => open(event.target.value as PanelId)}
        >
          {panels.map((panel) => (
            <option key={panel.id} value={panel.id}>
              {panel.label}
            </option>
          ))}
        </select>
        <button className="drawer-pin" aria-pressed={pinned} onClick={pin}>
          {pinned ? 'Unpin' : 'Pin'}
        </button>
        <button aria-label="Close panel" onClick={close}>
          ×
        </button>
      </header>
      <div className="drawer-content">{children}</div>
    </aside>
  )
}
