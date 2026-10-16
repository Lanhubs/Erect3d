// Pack only referenced vertices; material index ranges retain their order.
export function compactBuffers(positions:number[],uvs:number[],source:number[]){
  const remap=new Int32Array(positions.length/3).fill(-1),packed:number[]=[],texture:number[]=[]
  const indices=new Uint32Array(source.length)
  source.forEach((old,i)=>{
    if(remap[old]===-1){remap[old]=packed.length/3;packed.push(positions[old*3],positions[old*3+1],positions[old*3+2]);texture.push(uvs[old*2],uvs[old*2+1])}
    indices[i]=remap[old]
  })
  return {vertices:new Float32Array(packed),uvs:new Float32Array(texture),indices}
}
