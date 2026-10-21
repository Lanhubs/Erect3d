import {useEffect,useRef,type RefObject} from 'react'
import {activateOverlay,releaseOverlay,overlayIsActive} from './overlayCoordinator'
const overlays:symbol[]=[]
export function dismissMenu(event:KeyboardEvent,root:ParentNode=document){
  if(event.key!=='Escape')return false
  const menus=[...root.querySelectorAll<HTMLDetailsElement>('.studio-menu[open],.command-more[open],.view-options[open],.cloud-session-menu[open],.graphics-preference[open],.project-item-actions details[open]')].filter(e=>e.getClientRects().length)
  const menu=menus.find(e=>e.contains(document.activeElement))||menus.at(-1)
  if(!menu)return false
  event.preventDefault();event.stopImmediatePropagation();menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();return true
}
export function useOverlay(ref:RefObject<HTMLElement|null>,open:boolean,close:()=>void,focus=true,trap=true,exclusive=true){
  const latest=useRef(close);latest.current=close
  useEffect(()=>{
    if(!open)return
    const token=Symbol();overlays.push(token)
    const previous=document.activeElement as HTMLElement|null
    if(exclusive)activateOverlay(token,()=>latest.current())
    const controls=()=>[...ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]].filter(e=>e.getClientRects().length)
    if(focus&&!ref.current?.contains(document.activeElement))controls()[0]?.focus()
    const key=(event:KeyboardEvent)=>{
      if(overlays.at(-1)!==token||exclusive&&!overlayIsActive(token))return
      if(event.key==='Escape'){if(dismissMenu(event,ref.current?.getAttribute('aria-modal')==='true'?ref.current:document))return;event.preventDefault();event.stopImmediatePropagation();latest.current();return}
      if(trap&&event.key==='Tab'){
        const items=controls(),first=items[0],last=items.at(-1)
        if(!first)return
        if(event.shiftKey&&(!ref.current?.contains(document.activeElement)||document.activeElement===first)){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&(!ref.current?.contains(document.activeElement)||document.activeElement===last)){event.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key,true)
    return()=>{overlays.splice(overlays.indexOf(token),1);document.removeEventListener('keydown',key,true);const restore=exclusive?releaseOverlay(token):!overlays.length;if(restore){if(previous?.isConnected&&previous.getClientRects().length)previous.focus();else document.querySelector<HTMLElement>('.studio-tool-dock button')?.focus()}}
  },[open,ref,focus,trap,exclusive])
}
