import { useEffect, useState } from 'react'
import { capabilities } from './api'
import { SourcePanel } from './SourcePanel'
import { CollaborationPanel } from './CollaborationPanel'
import type { CloudSession } from './useCloudProject'
export function CloudTools({ session, close,reconstructRequest=0,open=true }: { session: CloudSession; close: () => void;reconstructRequest?:number;open?:boolean }) {
  const [tab, setTab] = useState<'source' | 'people'>('source'), [features, setFeatures] = useState<{ privateAssets: boolean; cloudAnalysis: boolean }>()
  const [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => { let alive = true; setError(''); capabilities().then(features => { if (alive) setFeatures(features) }).catch(error => { if (alive) setError(error.message) }); return () => { alive = false } }, [retry])
  return <aside hidden={!open} className="cloud-tools" aria-label="Project tools"><header><strong>Project tools</strong><button onClick={close} aria-label="Close project tools">×</button></header>
    <nav><button aria-pressed={tab === 'source'} onClick={() => setTab('source')}>Plan and proposals</button><button aria-pressed={tab === 'people'} onClick={() => setTab('people')}>Collaboration</button></nav>
    {error && <><p role="alert">{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry service check</button></>}
    {tab === 'source' ? features ? <SourcePanel session={session} available={features.privateAssets} aiAvailable={features.cloudAnalysis} reconstructRequest={reconstructRequest} /> : !error && <p role="status">Checking private storage and analysis service…</p> : <CollaborationPanel session={session} />}
  </aside>
}
