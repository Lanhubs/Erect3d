import type {CanopyBuffers} from './arenaCanopyBuffers'
// Top, glazing, fascia and soffit keep stable slots and independent normals.
// All coordinates and the authored 250 mm roof build-up are in project metres.
export function canopyRegions(positions:number[],uvs:number[],top:number[],glass:number[],closure:number[]):CanopyBuffers{
  const fascia:number[]=[],soffit:number[]=[],edges=new Map<string,{a:number;b:number;count:number}>(),lower=new Map<number,number>()
  const underside=(a:number)=>{
    if(lower.has(a))return lower.get(a)!
    const index=positions.length/3;positions.push(positions[a*3],positions[a*3+1]-.25,positions[a*3+2]);uvs.push(uvs[a*2],uvs[a*2+1]);lower.set(a,index);return index
  }
  for(let i=0;i<top.length;i+=3){
    soffit.push(underside(top[i]),underside(top[i+2]),underside(top[i+1]))
    for(let j=0;j<3;j++){
      const a=top[i+j],b=top[i+(j+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`,edge=edges.get(key)
      if(edge)edge.count++;else edges.set(key,{a,b,count:1})
    }
  }
  const flatTriangle=(a:number,b:number,c:number)=>{
    const index=positions.length/3
    for(const v of [a,b,c]){positions.push(positions[v*3],positions[v*3+1],positions[v*3+2]);uvs.push(uvs[v*2],uvs[v*2+1])}
    fascia.push(index,index+1,index+2)
  }
  const closureEdges=new Set<string>()
  for(let i=0;i<closure.length;i+=3)for(let j=0;j<3;j++){
    const a=closure[i+j],b=closure[i+(j+1)%3];closureEdges.add(`${Math.min(a,b)}:${Math.max(a,b)}`)
  }
  for(const {a,b,count} of edges.values())if(count===1&&!closureEdges.has(`${Math.min(a,b)}:${Math.max(a,b)}`)){
    const d=underside(a),e=underside(b);flatTriangle(a,d,b);flatTriangle(b,d,e)
  }
  for(let i=0;i<closure.length;i+=3)flatTriangle(closure[i],closure[i+1],closure[i+2])
  const indices=new Uint32Array([...top,...glass,...fascia,...soffit]),vertices=new Float32Array(positions),normals=new Float32Array(positions.length)
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3
    const ux=vertices[b]-vertices[a],uy=vertices[b+1]-vertices[a+1],uz=vertices[b+2]-vertices[a+2]
    const vx=vertices[c]-vertices[a],vy=vertices[c+1]-vertices[a+1],vz=vertices[c+2]-vertices[a+2]
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx
    for(const v of [a,b,c]){normals[v]+=nx;normals[v+1]+=ny;normals[v+2]+=nz}
  }
  for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length){normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length}}
  return {positions:vertices,uvs:new Float32Array(uvs),normals,indices,metalCount:top.length,
    regions:[top.length,glass.length,fascia.length,soffit.length]}
}
