import {useEffect,useRef,useState,type ReactNode} from 'react'
import {useOverlay} from '../app/useOverlay'
export function ViewportOptions({children}:{children:ReactNode}){
  const menu=useRef<HTMLDetailsElement>(null),content=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[sheet,setSheet]=useState(()=>matchMedia('(max-width:700px)').matches)
  const close=()=>{if(menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus()}}
  useOverlay(content,open&&sheet,close,true,true,false)
  useEffect(()=>{const media=matchMedia('(max-width:700px)'),change=()=>setSheet(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  return <details ref={menu} className="view-options" onToggle={event=>setOpen(event.currentTarget.open)}><summary>View options</summary><div ref={content} role={sheet?'dialog':undefined} aria-modal={sheet||undefined} aria-label={sheet?'View options':undefined}>
    <button className="view-options-close" onClick={close}>Close view options</button>{children}
  </div></details>
}
