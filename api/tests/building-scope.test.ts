import {expect,test} from 'bun:test'
import {assertBuildingScope} from '../src/modules/ai/building-scope'
import type {Intelligence} from '../src/contracts/analysis'
import {intelligenceSchema} from '../src/contracts/analysis'
const base:Intelligence={coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[]}
test('retired sports interpretations stop before repair or architecture generation',()=>{
  for(const buildingType of ['arena','stadium'] as const)expect(()=>assertBuildingScope({...base,understanding:{buildingType,footprint:[],conventions:[],circulation:[],uncertainties:[]}})).toThrow('BUILDING_TYPE_UNSUPPORTED')
})
test('building interpretation preserves the full range of non-sports typologies',()=>{
  for(const buildingType of ['duplex','villa','hotel','mixed-use','office-tower','industrial','hospital'] as const){
    const proposal={...base,understanding:{buildingType,footprint:[],conventions:[],circulation:[],uncertainties:[]}}
    expect(intelligenceSchema.safeParse(proposal).success).toBe(true)
    expect(()=>assertBuildingScope(proposal)).not.toThrow()
  }
})
