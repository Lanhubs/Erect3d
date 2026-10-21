import {useEffect,useRef} from 'react'
import {create} from 'zustand'
import {useOverlay} from './useOverlay'
import {activateOverlay,releaseOverlay} from './overlayCoordinator'
type Confirmation={message:string;label:string;resolve:(confirmed:boolean)=>void}
const useConfirmation=create<{value:Confirmation|null}>(()=>({value:null}))
export function confirmAction(message:string,label='Confirm'){
  useConfirmation.getState().value?.resolve(false)
  return new Promise<boolean>(resolve=>useConfirmation.setState({value:{message,label,resolve}}))
}
function Confirmation({value}:{value:Confirmation}){
  const ref=useRef<HTMLDivElement>(null),close=()=>{value.resolve(false);useConfirmation.setState({value:null})}
  useOverlay(ref,true,close)
  return <div className="command-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close()}}><div ref={ref} className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-heading">
    <h2 id="confirmation-heading">Confirm action</h2><p>{value.message}</p><footer><button onClick={close}>Cancel</button><button className="primary" onClick={()=>{value.resolve(true);useConfirmation.setState({value:null})}}>{value.label}</button></footer>
  </div></div>
}
export function ConfirmationHost(){
  const value=useConfirmation(s=>s.value)
  useEffect(()=>{
    const owners=new WeakMap<HTMLDetailsElement,symbol>()
    const toggle=(event:Event)=>{
      const menu=event.target
      if(!(menu instanceof HTMLDetailsElement)||!menu.matches('.studio-menu,.view-options,.cloud-session-menu,.graphics-preference,.project-item-actions details,.reconstruction-popover'))return
      const id=owners.get(menu)||Symbol();owners.set(menu,id)
      if(menu.open)activateOverlay(id,()=>{menu.open=false})
      else releaseOverlay(id)
    }
    document.addEventListener('toggle',toggle,true)
    return()=>document.removeEventListener('toggle',toggle,true)
  },[])
  return value?<Confirmation key={value.message} value={value}/>:null
}
