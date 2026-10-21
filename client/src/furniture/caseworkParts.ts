import type {PartBuilder} from './parts'
export function caseworkParts({object,add,legs,paint}:PartBuilder){
 const type=object.type,metal='#9ba5a8',dark='#30383b'
 if(['dining-table','coffee-table','desk'].includes(type)){
  const round=['round','oval'].includes(object.assetId)
  if(round){
   add(0,.08,0,.48,.12,.48,'#494b46','cylinder','metal')
   add(0,.5,0,.13,.79,.13,'#71634f','taper','timber')
  }else{legs(.9,'#6b563e','timber',.12);add(0,.82,0,.84,.12,.76,'#7c674d','soft-box','timber')}
  add(0,.96,0,1,.08,1,paint,round?'cylinder':'soft-box','timber')
  if(type==='desk'){
   add(.32,.49,0,.25,.78,.84,'#b49a79','soft-box','timber')
   for(const y of [.28,.51,.73])add(.32,y,.43,.15,.014,.025,metal,'soft-box','metal')
  }
 }else{
  const appliance=['refrigerator','washing-machine','cooker'].includes(type)
  const cabinet=type.includes('kitchen')||type.includes('cabinet')||type==='wardrobe'||type==='television-unit'||type==='bedside-table'
  legs(.09,dark,'metal')
  add(0,.5,0,.96,.88,.94,appliance?'#d0d2cf':paint,'soft-box',appliance?'metal':'timber')
  if(cabinet){
   const count=Math.max(1,Math.min(4,Math.round(object.width/.55)))
   for(let i=0;i<count;i++){
    const x=(i+.5)/count*.93-.465
    add(x,.51,.479,.9/count,.79,.025,paint,'soft-box','timber')
    add(x+.26/count,.59,.502,.018,.11,.024,metal,'cylinder','metal')
   }
   if(type.includes('kitchen'))add(0,.97,0,1,.06,1,'#dfdcd2','soft-box','stone')
  }else if(type==='washing-machine'){
   add(0,.84,.476,.9,.16,.024,'#e5e5df','soft-box','plastic')
   add(.28,.85,.5,.12,.035*object.depth/object.height,.085*object.height/object.depth,metal,'cylinder','metal',[Math.PI/2,0,0])
   add(0,.47,.49,.68,.08*object.depth/object.height,.68*object.height/object.depth,metal,'ring','metal',[Math.PI/2,0,0])
   add(0,.47,.52,.49,.49,.025,'#324750','sphere','glass').opacity=.7
  }else if(type==='cooker'){
   add(0,.96,0,.94,.045,.92,dark,'soft-box','metal')
   for(const x of [-.24,.24])for(const z of [-.24,.24])add(x,.985,z,.29,.012,.29,'#707779','ring','metal')
   add(0,.45,.478,.78,.56,.02,dark,'soft-box','glass')
   add(0,.74,.5,.025*object.height/object.width,.68*object.width/object.height,.035,metal,'cylinder','metal',[0,0,Math.PI/2])
  }else if(type==='refrigerator'){
   for(const y of [.31,.75])add(0,y,.48,.92,y===.75?.38:.48,.035,'#d6d8d5','soft-box','metal')
   for(const y of [.37,.75])add(.35,y,.51,.028,.22,.035,metal,'cylinder','metal')
  }
 }
}
