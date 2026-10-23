import { useEffect, useRef, useState } from 'react'
import {useOverlay} from '../app/useOverlay'
import { capabilities } from './api'
import { SourcePanel } from './SourcePanel'
import { CollaborationPanel } from './CollaborationPanel'
import type { CloudSession } from './useCloudProject'
import {useProject} from '../state/project'
import {reconstructionContext} from './reconstructionContext'
export function CloudTools({ session, close,reconstructRequest=0,open=true,initialTab='source' }: { session: CloudSession; close: () => void;reconstructRequest?:number;open?:boolean;initialTab?:'source'|'people' }) {
  const [tab, setTab] = useState<'source' | 'people'>(initialTab), [features, setFeatures] = useState<{ privateAssets: boolean; cloudAnalysis: boolean }>()
  const [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const ref=useRef<HTMLElement>(null);useOverlay(ref,open,close,true,false)
  const project=useProject(state=>state.project),levelId=useProject(state=>state.activeLevelId)
  useEffect(()=>{if(open)setTab(initialTab)},[open,initialTab])
  const context=project?reconstructionContext(project,levelId):undefined
  useEffect(() => { let alive = true; setError(''); capabilities().then(features => { if (alive) setFeatures(features) }).catch(error => { if (alive) setError(error.message) }); return () => { alive = false } }, [retry])
  return <aside ref={ref} hidden={!open} className="cloud-tools" aria-label="Project tools"><header><strong>Project tools</strong><button onClick={close} aria-label="Close project tools">×</button></header>
    <nav><button aria-pressed={tab === 'source'} onClick={() => setTab('source')}>Plan and proposals</button><button aria-pressed={tab === 'people'} onClick={() => setTab('people')}>Collaboration</button></nav>
    {error && <><p role="alert">{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry service check</button></>}
    <div hidden={tab!=='source'}>{features && context ? <SourcePanel key={`${context.projectId}/${context.levelId}/${context.sourceId}`} session={session} available={features.privateAssets} aiAvailable={features.cloudAnalysis} reconstructRequest={reconstructRequest} /> : !error && <p role="status">Checking private storage and analysis service…</p>}</div>
    {tab==='people' && <CollaborationPanel session={session}/>}
  </aside>
}
