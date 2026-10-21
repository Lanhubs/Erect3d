import { lazy,Suspense,useCallback,useEffect,useState } from 'react'
import { LandingPage } from './features/landing/LandingPage'
import { CloudRoute } from './cloud/CloudRoute'
import './App.css'
import {ConfirmationHost} from './app/ConfirmationHost'
import {closeFloatingOverlay} from './app/overlayCoordinator'
import './app/brandControls.css'
const GraphicsBenchmark=import.meta.env.DEV?lazy(()=>import('./rendering/GraphicsBenchmark')):null
function App() {
  const [route,setRoute]=useState(()=>window.location.pathname.replace(/\/$/,'') || '/')
  const navigate=useCallback((path:string)=>{closeFloatingOverlay();window.history.pushState({},'',path);setRoute(path)},[])
  useEffect(()=>{
    const change=()=>setRoute(window.location.pathname.replace(/\/$/,'') || '/')
    window.addEventListener('popstate',change);return()=>window.removeEventListener('popstate',change)
  },[])
  if (route==='/dev/graphics' && GraphicsBenchmark) return <Suspense fallback={<p>Preparing renderer…</p>}><GraphicsBenchmark/></Suspense>
  if (route==='/') return <LandingPage projects={[]} onStartDesigning={()=>navigate('/projects')} onOpenWorkspace={()=>navigate('/projects')} />
  return <><CloudRoute route={route} navigate={navigate} /><ConfirmationHost/></>
}
export default App
