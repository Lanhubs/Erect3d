import {MeshPhysicalMaterial,MeshStandardMaterial} from 'three'
export function architecturalMaterial(key:string,color:string){
  if(key==='window-glass'||key==='frosted-glass')return new MeshPhysicalMaterial({color,metalness:0,roughness:key==='frosted-glass'?.48:.08,
    ior:1.5,thickness:.008,transparent:true,opacity:key==='frosted-glass'?.76:.3,depthWrite:false})
  if(key==='facade-glass')return new MeshPhysicalMaterial({color,metalness:0,roughness:.12,ior:1.5,thickness:.012,transparent:true,opacity:.38,depthWrite:false})
  if(key==='glass')return new MeshPhysicalMaterial({color,metalness:.02,roughness:.12,ior:1.5,transparent:true,opacity:.5,depthWrite:false})
  const roughness=key==='metal'?.34:key==='timber'?.68:key==='stone'?.72:key==='seat'?.52:key==='render'?.92:.86
  return new MeshStandardMaterial({color,roughness,metalness:key==='metal'?.65:0})
}
