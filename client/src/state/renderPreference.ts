import {create} from 'zustand'
export type PreferredRenderer='auto'|'webgl'
function saved():PreferredRenderer{try{return localStorage.getItem('erect-renderer')==='webgl'?'webgl':'auto'}catch{return 'auto'}}
export const useRenderPreference=create<{renderer:PreferredRenderer;setRenderer:(renderer:PreferredRenderer)=>void}>(set=>({
  renderer:saved(),setRenderer:renderer=>{try{localStorage.setItem('erect-renderer',renderer)}catch{}set({renderer})},
}))
