import {expect,test} from 'bun:test'
import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three'
import {furnitureGeometry} from '../src/furniture/geometry'
import {FurnitureResources} from '../src/furniture/resources'
import {furnitureParts} from '../src/furniture/assets'
import {newFurniture} from '../src/furniture/entities'
import {blankLevel} from '../src/domain/levels'
import {candidateFurniture} from '../src/intelligence/candidateFurniture'
const level=blankLevel('Ground',0,3)
test('a ceramic basin has a genuinely recessed interior, not a flat painted box',()=>{
 const geometry=furnitureGeometry('bowl'),material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material)
 mesh.updateMatrixWorld()
 const ray=new Raycaster(new Vector3(0,2,0),new Vector3(0,-1,0))
 const centre=ray.intersectObject(mesh)[0]
 ray.set(new Vector3(.45,2,0),new Vector3(0,-1,0));const rim=ray.intersectObject(mesh)[0]
 expect(centre.point.y).toBeLessThan(-.25);expect(rim.point.y).toBeGreaterThan(.4)
 expect(geometry.index).toBeTruthy();expect(geometry.boundingSphere?.radius).toBeGreaterThan(.5)
 geometry.dispose();material.dispose()
})
test('furniture uses metre-sized rounded profiles and shares resources until their last owner releases',async()=>{
 const sofa=newFurniture(level,'sofa',{x:0,z:0}),part=furnitureParts(sofa).find(p=>p.finish==='fabric')!,resources=new FurnitureResources()
 const a=resources.geometry(part),b=resources.geometry({...part});expect(a).toBe(b)
 const size=a.boundingBox!.getSize(new Vector3());expect(size.x).toBeCloseTo(part.size[0]);expect(size.y).toBeCloseTo(part.size[1])
 resources.retain(part);resources.retain(part);resources.release(part);await Promise.resolve();expect(resources.geometry(part)).toBe(a)
 resources.release(part);await Promise.resolve();expect(resources.geometries.size).toBe(0)
 resources.dispose()
})
test('source furniture retains rotation, oriented footprint, table shape and type-specific height',()=>{
 const candidate={id:'table',kind:'furniture' as const,furnitureType:'dining-table',furnitureRotation:90,furnitureVariant:'round',points:[],confidence:.9,evidence:'Round dining table',uncertainties:[],needsReview:true as const}
 const table=candidateFurniture(candidate,[{x:1,z:2},{x:1,z:4},{x:2,z:4},{x:2,z:2}],'dining-table')
 expect(table).toMatchObject({rotation:90,assetId:'round',height:.76});expect(table.width).toBeCloseTo(2);expect(table.depth).toBeCloseTo(1)
 const refrigerator=candidateFurniture({...candidate,furnitureRotation:0,furnitureVariant:undefined},[{x:0,z:0},{x:.75,z:.65}],'refrigerator')
 expect(refrigerator.height).toBe(2)
 const parts=furnitureParts({...newFurniture(level,'dining-table',{x:0,z:0}),assetId:'round'})
 expect(parts.at(-1)?.shape).toBe('cylinder')
})
