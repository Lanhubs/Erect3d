import {PerspectiveCamera,Vector3} from 'three'
import {ground,planSvg,windowAt} from './model'
import {cameraAt,envelope,mix,progress} from './timeline'
const camera=new PerspectiveCamera(),point=new Vector3()
function project(x:number,z:number,t:number){const c=cameraAt(t);camera.aspect=1920/1080;camera.fov=c.fov;camera.position.set(...c.position);camera.lookAt(...c.target);camera.updateProjectionMatrix();camera.updateMatrixWorld();point.set(x,.04,z).project(camera);return [(point.x+1)*960,(1-point.y)*540]}
function Copy({time,start,end,children,className=''}:{time:number;start:number;end:number;children:React.ReactNode;className?:string}){const opacity=envelope(time,start,end);return <div className={`film-copy ${className}`} style={{opacity,transform:`translateY(${mix(24,0,progress(time,start,start+.5))}px)`}}>{children}</div>}
export function FilmOverlays({time:t}:{time:number}){
 const early=envelope(t,3,12.5),edit=envelope(t,24,28),intro=1-progress(t,2.65,3.2),ending=progress(t,32.6,33.1)
 const mark=(x:number,z:number)=>{const [a,b]=project(x,z,t);return `${a},${b}`}
 return <div className="film-overlays">
 <div className="film-identity" style={{opacity:intro,pointerEvents:'none'}}><svg viewBox="0 0 1920 1080"><path d="M0 380H1920" style={{strokeDasharray:1920,strokeDashoffset:1920*(1-progress(t,0,.95))}}/><path d="M960 330V730" style={{strokeDasharray:400,strokeDashoffset:400*(1-progress(t,.4,1.4))}}/></svg><div className="film-identity-lockup" style={{clipPath:`inset(0 ${100*(1-progress(t,.45,1.25))}% 0 0)`}}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Erect3D logo"/><span>ERECT<span>3D</span></span></div><h1 style={{opacity:progress(t,.85,1.5),transform:`translateY(${20*(1-progress(t,.85,1.5))}px)`}}>DESIGN IN 2D.<br/>EXPERIENCE IT IN 3D.</h1><p>ARCHITECTURE, IN YOUR HANDS.</p></div>
 <div className="film-corner-brand" style={{opacity:envelope(t,3.1,32.2)}}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>ERECT3D</span></div>
 <svg className="film-annotation" viewBox="0 0 1920 1080" style={{opacity:early}}>
 {ground.rooms.map(room=>{const x=room.polygon.reduce((s,p)=>s+p.x,0)/room.polygon.length,z=room.polygon.reduce((s,p)=>s+p.z,0)/room.polygon.length,[a,b]=project(x,z,t);return <text key={room.id} x={a} y={b} textAnchor="middle" style={{fontSize:16,fill:"#81796d",opacity:1-progress(t,7.3,8)}}>{room.name}</text>})}
 {ground.walls.map((w,i)=><path key={w.id} d={`M${mark(w.start.x,w.start.z)}L${mark(w.end.x,w.end.z)}`} stroke="#b17b43" strokeWidth={i<4?4:2} pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress(t,4+i*.12,4.8+i*.12)} opacity={envelope(t,4+i*.12,8.8)}/>)}
 {ground.windows.map(w=>{const wall=ground.walls.find(x=>x.id===w.wallId)!;const dx=(wall.end.x-wall.start.x)/12,dz=(wall.end.z-wall.start.z)/12;return <path key={w.id} d={`M${mark(wall.start.x+dx*w.offset,wall.start.z+dz*w.offset)}L${mark(wall.start.x+dx*(w.offset+w.width),wall.start.z+dz*(w.offset+w.width))}`} stroke="#b17b43" strokeWidth={8} opacity={envelope(t,6.2,7.5)}/>})}
 {([{name:'Wall',x:0,z:4,start:8.1},{name:'Window',x:2.3,z:0,start:8.5},{name:'Room',x:2.5,z:3,start:9.1},{name:'Door',x:6,z:10,start:9.7},{name:'Stair',x:6,z:6,start:10.2}]).map(s=>{const [x,y]=project(s.x,s.z,t);return <g key={s.name} opacity={envelope(t,s.start,s.start+1.55)}><circle cx={x} cy={y} r="5" fill="#b17b43"/><path d={`M${x},${y}l42,-38h80`} stroke="#a18c70" strokeWidth="1.5"/><text x={x+48} y={y-49}>{s.name}</text></g>})}
 </svg>
 <Copy time={t} start={3.8} end={5.7} className="film-top"><h2>FROM FLOOR PLAN—</h2></Copy>
 <Copy time={t} start={8.8} end={11.8} className="film-top"><p>UNDERSTOOD AS ARCHITECTURE.</p></Copy>
 <Copy time={t} start={12.7} end={15.5} className="film-top"><h2>ERECTED IN 3D.</h2></Copy>
 <Copy time={t} start={19.8} end={23.7} className="film-words">{['DETAILED.','EDITABLE.','YOURS.'].map((word,i)=><div key={word} style={{opacity:progress(t,20+i*.65,20.45+i*.65),transform:`translateY(${18*(1-progress(t,20+i*.65,20.45+i*.65))}px)`}}>{word}</div>)}</Copy>
 <div className="film-edit" style={{opacity:edit}}><div className="film-edit-plan" dangerouslySetInnerHTML={{__html:planSvg(windowAt(t).width,false)}}/><div className="film-edit-field"><span>WINDOW · WIDTH</span><b>{windowAt(t).width.toFixed(2)} <small>m</small></b><div className="film-edit-line"><i style={{width:`${30+progress(t,25,26.5)*52}%`}}/></div></div></div>
 <Copy time={t} start={24.5} end={27.9} className="film-bottom"><h2>NOT A RENDER.</h2><p>A BUILDING YOU CAN KEEP DESIGNING.</p></Copy>
 <Copy time={t} start={28.8} end={31.8} className="film-walk-copy"><h2>WALK IT BEFORE IT EXISTS.</h2></Copy>
 <div className="film-camera-cut" style={{opacity:envelope(t,31.95,32.75,.3)}}/>
 <div className="film-end" style={{opacity:ending}}><div className="film-end-title"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Erect3D logo"/><h2>FROM PLAN<br/>TO PLACE.</h2><p>ERECT3D</p><small>erect3d.olanrewaju.xyz</small></div></div>
 <div className="film-drawing-note" style={{opacity:early}}><span>MAPLE HOUSE</span><span>GROUND FLOOR · METRES</span><i/><span>AUTHORED ERECT3D MODEL</span></div>
 </div>
}



