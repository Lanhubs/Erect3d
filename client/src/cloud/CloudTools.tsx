import { useEffect, useState } from 'react'
import { capabilities } from './api'
import { SourcePanel } from './SourcePanel'
import { CollaborationPanel } from './CollaborationPanel'
import type { CloudSession } from './useCloudProject'
export function CloudTools({ session, close }: { session: CloudSession; close: () => void }) {
  const [tab, setTab] = useState<'source' | 'people'>('source'), [features, setFeatures] = useState({ privateAssets: false, cloudAnalysis: false })
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; capabilities().then(features => { if (alive) setFeatures(features) }).catch(error => { if (alive) setError(error.message) }); return () => { alive = false } }, [])
  return <aside className="cloud-tools" aria-label="Cloud project tools"><header><strong>Cloud project tools</strong><button onClick={close} aria-label="Close cloud tools">×</button></header>
    <nav><button aria-pressed={tab === 'source'} onClick={() => setTab('source')}>Plan and proposals</button><button aria-pressed={tab === 'people'} onClick={() => setTab('people')}>Collaboration</button></nav>
    {error && <p role="alert">{error}</p>}
    {tab === 'source' ? <SourcePanel session={session} available={features.privateAssets} aiAvailable={features.cloudAnalysis} /> : <CollaborationPanel session={session} />}
  </aside>
}
