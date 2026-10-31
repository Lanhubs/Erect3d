import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiColumns,
  FiEdit3,
  FiHelpCircle,
  FiLayers,
  FiMaximize2,
  FiMoreHorizontal,
  FiMousePointer,
  FiMove,
  FiPenTool,
  FiRotateCcw,
  FiRotateCw,
  FiSave,
  FiSearch,
  FiSquare,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import type { Selection } from '../domain/types'
import type { Tool, View } from '../state/project'
import { useProject } from '../state/project'
import { panels, type PanelId } from './WorkspacePanels'
import { ConstructionAssistantIcon } from '../components/construction-assistant-icon'
import { ExportMenu } from '../cad/ExportMenu'
import { StudioViewDock } from './StudioViewDock'
import { choose, type WorkspaceMode } from './menuChoice'

export type { WorkspaceMode } from './menuChoice'
export const drawingTools = [
  { id: 'select', label: 'Select', icon: FiMousePointer },
  { id: 'pan', label: 'Pan', icon: FiMove },
  { id: 'wall', label: 'Wall', icon: FiEdit3 },
  { id: 'curve', label: 'Curve', icon: FiPenTool },
  { id: 'ramp', label: 'Ramp', icon: FiTrendingUp },
  { id: 'door', label: 'Door', icon: FiSquare },
  { id: 'window', label: 'Window', icon: FiMaximize2 },
  { id: 'room', label: 'Room', icon: FiLayers },
  { id: 'measure', label: 'Measure', icon: FiColumns },
] as const
type Props = {
  projectName: string
  dirty: boolean
  back: () => void
  undo: () => void
  redo: () => void
  save: () => void
  tool: Tool
  setTool: (tool: Tool) => void
  view: View
  setView: (view: View) => void
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
  walk: () => void
  selection: Selection
  inspectorOpen: boolean
  toggleInspector: () => void
  inspectorAvailable: boolean
  search: () => void
  openPanel: (id: PanelId) => void
  walking: boolean
  collaborate?: () => void
  assistant?: () => void
  assistantOpen?: boolean
  previewing?: boolean
}
const shortcuts =
  'Arrow keys move; Shift gives finer steps. [ / ] rotate; comma / period resize; Page Up / Down adjust height. Ctrl/Cmd Z undoes. Scroll or pinch zooms 3D; Ctrl + / - zooms; Ctrl 0 fits.'
export function WorkspaceHeader({
  projectName,
  dirty,
  back,
  undo,
  redo,
  save,
  tool,
  setTool,
  view,
  setView,
  mode,
  setMode,
  walk,
  selection,
  inspectorOpen,
  toggleInspector,
  inspectorAvailable,
  search,
  openPanel,
  walking,
  collaborate,
  assistant,
  assistantOpen,
  previewing,
}: Props) {
  const permissionReadOnly = useProject((s) => s.readOnly),
    readOnly = permissionReadOnly || previewing,
    drawing = drawingTools.find((item) => item.id === tool)!
  const draw = (next: Tool) => {
    setMode('edit')
    setTool(next)
  }
  const toolButton = (item: (typeof drawingTools)[number], mobile = false) => (
    <button
      key={item.id}
      className={`${mobile ? 'mobile-tool' : 'desktop-tool'} ${['select', 'pan'].includes(item.id) ? 'navigation-tool' : ''}`}
      disabled={readOnly && !['select', 'pan', 'measure'].includes(item.id)}
      data-tooltip={item.label}
      aria-label={item.label}
      aria-pressed={tool === item.id}
      onClick={(event) => choose(event, () => draw(item.id))}
    >
      <item.icon />
      <span>{item.label}</span>
    </button>
  )
  return (
    <>
      <header className="studio-filebar">
        <button className="studio-home" aria-label="Projects" data-tooltip="Back to projects" onClick={back}>
          <img src="/favicon.svg" alt="" />
          <FiArrowLeft />
        </button>
        <div className="studio-document">
          <span>Workspace</span>
          <b title={projectName}>{projectName}</b>
        </div>
        <span
          className={`studio-save-state${dirty ? ' saving' : ''}`}
          data-tooltip={
            permissionReadOnly
              ? 'Read only'
              : previewing
                ? 'Previewing proposed changes'
                : dirty
                  ? 'Saving device draft'
                  : 'Device draft saved'
          }
        >
          <FiCheck />
          <span>
            {permissionReadOnly ? 'Read only' : previewing ? 'Preview' : dirty ? 'Saving…' : 'Saved'}
          </span>
        </span>
        <div className="studio-file-actions">
          {collaborate && (
            <button
              className="studio-collaborate"
              aria-label="Collaborate"
              onClick={collaborate}
              data-tooltip="People, access and discussion"
            >
              <FiUsers />
              <span>Collaborate</span>
            </button>
          )}
          <ExportMenu />
          <button aria-label="Find a control" data-tooltip="Find a control · Ctrl/Cmd K" onClick={search}>
            <FiSearch />
            <kbd>Ctrl K</kbd>
          </button>
          <details className="studio-menu studio-help">
            <summary aria-label="Workspace help" data-tooltip="Workspace help">
              <FiHelpCircle />
            </summary>
            <div>
              <strong>Working with your building</strong>
              <p>
                Choose a drawing tool below. Select an element to edit its properties. Levels and source plans
                live in the left panel.
              </p>
              <p>{shortcuts}</p>
            </div>
          </details>
        </div>
      </header>
      <div className="studio-tool-dock" role="toolbar" aria-label="Drawing tools">
        {assistant && (
          <button
            className="studio-assistant"
            aria-label="Assistant"
            data-tooltip="Design assistant"
            aria-pressed={assistantOpen}
            onClick={assistant}
          >
            <ConstructionAssistantIcon size={40} />
            <span>Assistant</span>
          </button>
        )}
        <div className="studio-drawing-tools">{drawingTools.map((item) => toolButton(item))}</div>
        <details className="studio-menu studio-draw-menu">
          <summary aria-label="Drawing tools menu" aria-pressed={!['select', 'pan'].includes(tool)}>
            <drawing.icon />
            <span>{['select', 'pan'].includes(tool) ? 'Build' : drawing.label}</span>
            <FiChevronDown />
          </summary>
          <div>
            {drawingTools
              .filter((item) => !['select', 'pan'].includes(item.id))
              .map((item) => toolButton(item, true))}
          </div>
        </details>
        <details className="studio-menu studio-panels-menu">
          <summary aria-label="Building panels menu">
            <FiLayers />
            <span>Panels</span>
          </summary>
          <div>
            {panels.map((panel) => (
              <button key={panel.id} onClick={(event) => choose(event, () => openPanel(panel.id))}>
                <panel.icon />
                <span>{panel.label}</span>
              </button>
            ))}
          </div>
        </details>
        <div className="studio-history">
          <button disabled={readOnly} data-tooltip="Undo · Ctrl/Cmd Z" aria-label="Undo" onClick={undo}>
            <FiRotateCcw />
            <span>Undo</span>
          </button>
          <button
            className="studio-redo"
            disabled={readOnly}
            data-tooltip="Redo · Ctrl/Cmd Shift Z"
            aria-label="Redo"
            onClick={redo}
          >
            <FiRotateCw />
            <span>Redo</span>
          </button>
          <button disabled={readOnly} data-tooltip="Save" aria-label="Save" onClick={save}>
            <FiSave />
            <span>Save</span>
          </button>
        </div>
        <details className="studio-menu studio-mobile-more">
          <summary aria-label="More workspace controls">
            <FiMoreHorizontal />
            <span>More</span>
          </summary>
          <div>
            <button
              className="small-screen-undo"
              disabled={readOnly}
              onClick={(event) => choose(event, undo)}
            >
              <FiRotateCcw />
              Undo
            </button>
            <button disabled={readOnly} onClick={(event) => choose(event, redo)}>
              <FiRotateCw />
              Redo
            </button>
            <button onClick={(event) => choose(event, search)}>
              <FiSearch />
              Find a control
            </button>
            {panels.map((panel) => (
              <button key={panel.id} onClick={(event) => choose(event, () => openPanel(panel.id))}>
                <panel.icon />
                {panel.label}
              </button>
            ))}
            <button onClick={(event) => choose(event, () => setMode('analyze'))}>Analyze building</button>
            <button onClick={(event) => choose(event, () => setMode('present'))}>Present building</button>
            <p>{shortcuts}</p>
          </div>
        </details>
      </div>
      <StudioViewDock
        mode={mode}
        setMode={setMode}
        view={view}
        setView={setView}
        walk={walk}
        walking={walking}
        selection={selection}
        inspectorOpen={inspectorOpen}
        toggleInspector={toggleInspector}
        inspectorAvailable={inspectorAvailable}
      />
    </>
  )
}
