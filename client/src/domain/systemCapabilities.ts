import type {BuildingSystem} from './buildingSystems'
import {maxFloorInstances} from './floorRepetition'
type Numeric={key:string;label:string;min:number;max:number;integer?:boolean}
type Capability={label:string;fields:Numeric[]}
const dimension=(key:string,label:string,min=.05,max=2000):Numeric=>({key,label,min,max})
export const systemCapabilities:Record<BuildingSystem['kind'],Capability>={
  'spiral-stair':{label:'Spiral circulation stair',fields:[dimension('height','Total rise'),dimension('radius','Outer radius'),dimension('width','Flight width'),dimension('riserHeight','Target riser',.05,.4),dimension('turnHeight','Rise per turn',1,20)]},
  articulation:{label:'Architectural detail system',fields:[dimension('height','Height'),dimension('depth','Projection'),dimension('thickness','Section thickness',.02,20),dimension('spacing','Spacing',.08)]},
  core:{label:'Circulation core',fields:[dimension('height','Height'),dimension('thickness','Wall thickness',.05,5)]},
  shaft:{label:'Vertical shaft',fields:[dimension('height','Height'),dimension('thickness','Lining thickness',.05,5)]},
  void:{label:'Atrium / courtyard',fields:[dimension('height','Vertical extent')]},
  beam:{label:'Structural beam',fields:[dimension('width','Width',.05,20),dimension('height','Depth',.05,20)]},
  'curtain-wall':{label:'Curtain wall',fields:[dimension('height','Height'),dimension('bayWidth','Bay width',.1,20),dimension('transomHeight','Transom spacing',.1,20),dimension('depth','Frame depth',.03,2)]},
  massing:{label:'Massing volume',fields:[dimension('height','Height')]},
  'typical-floors':{label:'Linked floor group',fields:[{key:'count',label:'Floor count',min:1,max:maxFloorInstances,integer:true},dimension('floorHeight','Floor to floor',2,20)]},
}
