import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiColumns, FiEdit3, FiLayers, FiMaximize2, FiMousePointer, FiMove,
  FiRotateCcw, FiRotateCw, FiSave, FiSquare } from 'react-icons/fi'
import type { Selection } from '../domain/types'
import type { Tool, View } from '../state/project'

export type WorkspaceMode = 'edit' | 'analyze' | 'present'
const tools = [
  { id: 'select', label: 'Select', icon: FiMousePointer }, { id: 'pan', label: 'Pan', icon: FiMove },
  { id: 'wall', label: 'Wall', icon: FiEdit3 }, { id: 'door', label: 'Door', icon: FiSquare },
  { id: 'window', label: 'Window', icon: FiMaximize2 }, { id: 'room', label: 'Room', icon: FiLayers },
  { id: 'measure', label: 'Measure', icon: FiColumns },
] as const
type Props = {
  projectName: string; dirty: boolean; back: () => void; undo: () => void; redo: () => void; save: () => void
  tool: Tool; setTool: (tool: Tool) => void; view: View; setView: (view: View) => void
  mode: WorkspaceMode; setMode: (mode: WorkspaceMode) => void; walk: () => void
  selection: Selection; inspectorOpen: boolean; toggleInspector: () => void; inspectorAvailable: boolean
}

export function WorkspaceHeader({ projectName, dirty, back, undo, redo, save, tool, setTool, view, setView,
  mode, setMode, walk, selection, inspectorOpen, toggleInspector, inspectorAvailable }: Props) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsButton = useRef<HTMLButtonElement>(null)
  const closeTools = () => { setToolsOpen(false); requestAnimationFrame(() => toolsButton.current?.focus()) }
  useEffect(() => {
    if (!toolsOpen) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') closeTools() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [toolsOpen])
  const chooseView = (next: View) => { setMode('edit'); setView(next) }
  return <>
    <header className="appbar">
      <button className="back" title="Projects" aria-label="Projects" onClick={back}><FiArrowLeft /></button>
      <div className="app-name"><strong>ERECT <em>3D</em></strong><span>/</span><b>{projectName}</b></div>
      <div className="app-actions">
        <span className="save-state">{dirty ? 'Unsaved changes' : 'Saved locally'}</span>
        <button title="Undo" aria-label="Undo" onClick={undo}><FiRotateCcw /></button>
        <button title="Redo" aria-label="Redo" onClick={redo}><FiRotateCw /></button>
        <button title="Save" aria-label="Save" onClick={save}><FiSave /><span>Save</span></button>
      </div>
    </header>
    <div className="workspace-top">
      <div className="toolset">{tools.map(item => <button key={item.id} title={item.label}
        aria-label={item.label} aria-pressed={tool === item.id} className={tool === item.id ? 'active' : ''}
        onClick={() => { setMode('edit'); setTool(item.id) }}><item.icon /><span>{item.label}</span></button>)}</div>
      <button ref={toolsButton} className="more-tools" aria-expanded={toolsOpen} onClick={() => setToolsOpen(true)}>Tools</button>
      <div className="viewset">
        <button aria-pressed={mode === 'edit' && view === 'plan'} className={mode === 'edit' && view === 'plan' ? 'active' : ''} onClick={() => chooseView('plan')}>2D</button>
        <button aria-pressed={mode === 'edit' && view === 'split'} className={mode === 'edit' && view === 'split' ? 'active' : ''} onClick={() => chooseView('split')}>Split</button>
        <button aria-pressed={mode === 'edit' && view === 'model'} className={mode === 'edit' && view === 'model' ? 'active' : ''} onClick={() => chooseView('model')}>3D</button>
      </div>
      <div className="mode-actions">
        <button onClick={walk}>Walk</button>
        <button aria-pressed={mode === 'analyze'} className={mode === 'analyze' ? 'active' : ''} onClick={() => setMode('analyze')}>Analyze</button>
        <button aria-pressed={mode === 'present'} className={mode === 'present' ? 'active' : ''} onClick={() => setMode('present')}>Present</button>
      </div>
      {inspectorAvailable && <button className={`inspector-toggle${inspectorOpen ? ' active' : ''}`} type="button"
        aria-label="Toggle properties" aria-expanded={inspectorOpen} onClick={toggleInspector}>
        Properties{selection ? ' · Selected' : ''}</button>}
    </div>
    {toolsOpen && <>
      <button className="tool-sheet-scrim" aria-label="Close tools" onClick={closeTools} />
      <div className="tool-sheet" role="dialog" aria-label="Drawing tools">
        <div><strong>TOOLS</strong><button onClick={closeTools} aria-label="Close tools">×</button></div>
        <nav>{tools.map(item => <button key={item.id} aria-pressed={tool === item.id}
          onClick={() => { setMode('edit'); setTool(item.id); closeTools() }}>
          <item.icon />{item.label}</button>)}</nav>
      </div>
    </>}
  </>
}
