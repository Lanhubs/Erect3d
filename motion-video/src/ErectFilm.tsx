import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {FilmScene} from './FilmScene'
import {FilmOverlays} from './FilmOverlays'
import {FILM,FilmTimeline,scenes} from './timeline'
import './film.css'
declare global{interface Window{erectFilm?:{duration:number;fps:number;seek:(seconds:number)=>Promise<void>;play:()=>void;pause:()=>void}}}
export default function ErectFilm(){
 const query=useMemo(()=>new URLSearchParams(location.search),[]),capture=query.get('capture')==='true',transport=query.get('transport')==='true'
 const timeline=useMemo(()=>new FilmTimeline(),[]),time=useSyncExternalStore(timeline.subscribe,timeline.snapshot),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[scale,setScale]=useState(1),host=useRef<HTMLDivElement>(null)
 const sceneReady=useCallback(()=>{Promise.all([document.fonts.load('400 16px "Film Sans"'),document.fonts.load('500 16px "Film Sans"'),document.fonts.load('400 16px "Film Mono"'),new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(Error('Logo could not load'));image.src=`${import.meta.env.BASE_URL}favicon.svg`})]).then(()=>setReady(true)).catch(()=>setReady(false))},[])
 useEffect(()=>{const node=host.current!;const observer=new ResizeObserver(()=>setScale(capture?1:Math.min(node.clientWidth/1920,node.clientHeight/1080)));observer.observe(node);return()=>observer.disconnect()},[capture])
 useEffect(()=>{if(!ready)return;timeline.seek(Number(query.get('t'))||0);if(!capture&&query.get('autoplay')!=='false'){timeline.play();setPlaying(true)}},[ready,capture,query,timeline])
 useEffect(()=>{window.erectFilm={duration:FILM.duration,fps:FILM.fps,pause:()=>{timeline.pause();setPlaying(false)},play:()=>{timeline.play();setPlaying(true)},seek:async(seconds)=>{if(document.querySelector('.film-root')?.getAttribute('data-ready')!=='true')throw Error('Wait for data-ready before seeking');timeline.pause();setPlaying(false);timeline.seek(seconds);await new Promise<void>((resolve,reject)=>{const start=performance.now();const check=()=>{if(document.querySelector<HTMLCanvasElement>('.film-frame canvas')?.dataset.renderedTime===timeline.time.toFixed(6)&&document.querySelector('.film-root')?.getAttribute('data-time')===timeline.time.toFixed(6))resolve();else if(performance.now()-start>10000)reject(Error('Film frame did not render'));else requestAnimationFrame(check)};requestAnimationFrame(check)})}};return()=>{timeline.dispose();delete window.erectFilm}},[timeline])
 const toggle=()=>{if(timeline.playing)timeline.pause();else timeline.play();setPlaying(timeline.playing)}
 return <main className={`film-root${capture?` film-capture${transport?' film-transport':''}`:''}`} data-ready={ready} data-time={time.toFixed(6)} data-frame={Math.round(time*FILM.fps)} aria-label="Erect3D product film">
 <div className="film-stage" ref={host}><div className="film-frame" style={{transform:`translate(-50%,-50%) scale(${scale})`}}><FilmScene timeline={timeline} onReady={sceneReady}/><FilmOverlays time={time}/>{!ready&&<div className="film-loading" role="status">Preparing the architectural film…</div>}</div></div>
 {(!capture||transport)&&<footer className="film-controls"><a href="/projects">Erect3D</a><button disabled={!ready} onClick={toggle}>{playing&&time<35?'Pause':'Play'}</button><button disabled={!ready} onClick={()=>{timeline.pause();timeline.seek(0);setPlaying(false)}}>Restart</button><label className="film-scrubber">Timeline<input aria-label="Film timeline" type="range" min="0" max="35" step=".033333333333" value={time} onChange={e=>{timeline.pause();timeline.seek(Number(e.target.value));setPlaying(false)}}/></label><label>Time<input aria-label="Time in seconds" type="number" min="0" max="35" step=".1" value={Number(time.toFixed(2))} onChange={e=>{timeline.pause();timeline.seek(Number(e.target.value));setPlaying(false)}}/></label><output>{time.toFixed(2)} / 35.00 s</output><select aria-label="Jump to scene" value={[...scenes].reverse().find(s=>time>=s.start)?.start||0} onChange={e=>{timeline.pause();timeline.seek(Number(e.target.value));setPlaying(false)}}>{scenes.map(s=><option key={s.start} value={s.start}>{s.name}</option>)}</select><a href="?capture=true&t=0">Capture mode</a></footer>}
 </main>
}



