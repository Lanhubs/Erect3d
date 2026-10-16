import {BufferGeometry,Float32BufferAttribute} from 'three'
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import type {RoofFace} from './roof'
// Each roof plane has outward/upward winding, physical UVs and a distinct
// underside. A two-sided textured plane cannot represent a roof soffit.
export function roofSurfaceGeometry(faces:RoofFace[],top=true){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[]
 for(const face of faces){
  if(face.length<3)continue
  const [a,b,c]=face,ab=b.map((n,i)=>n-a[i]),ac=c.map((n,i)=>n-a[i])
  const nx=ab[1]*ac[2]-ab[2]*ac[1],ny=ab[2]*ac[0]-ab[0]*ac[2],nz=ab[0]*ac[1]-ab[1]*ac[0],start=positions.length/3
  for(const [x,y,z] of face){positions.push(x,y,z);uv.push(Math.abs(nx)>Math.abs(nz)?z/2:x/2,Math.abs(nx)>Math.abs(nz)?x/2:z/2)}
  for(let i=1;i<face.length-1;i++)indices.push(...(top&&ny<0?[start,start+i+1,start+i]:[start,start+i,start+i+1]))
 }
 const raw=new BufferGeometry();raw.setAttribute('position',new Float32BufferAttribute(positions,3));raw.setAttribute('uv',new Float32BufferAttribute(uv,2));raw.setIndex(indices);raw.computeVertexNormals()
 // Vertices are shared within a plane; hard folds retain their own normals.
 const geometry=mergeVertices(raw);raw.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry
}
export function roofSoffitGeometry(surface:BufferGeometry,depth=.1){
 const geometry=surface.clone(),index=geometry.getIndex()!
 for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a)}
 geometry.translate(0,-depth,0);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry
}
