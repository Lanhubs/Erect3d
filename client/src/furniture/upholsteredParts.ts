import type {PartBuilder} from './parts'
export function upholsteredParts({object,paint,add,legs}:PartBuilder){
 const type=object.type
 if(type==='bed'){
  legs(.2);add(0,.25,0,.97,.16,.95,'#79644e','soft-box','timber')
  add(0,.44,.015,.95,.24,.91,'#ece8de','soft-box','fabric')
  add(0,.68,-.46,1,.62,.08,paint,'soft-box','fabric')
  add(0,.58,.16,.97,.12,.61,'#6b8581','soft-box','fabric')
  add(0,.65,-.08,.96,.07,.16,'#afbeb5','soft-box','fabric')
  for(const x of object.assetId==='single'||object.width<1.2?[0]:[-.23,.23]){
   add(x,.64,-.3,object.width<1.2?.76:.42,.14,.22,'#f6f1e7','soft-box','fabric',[.1,0,x*.12])
  }
  add(0,.65,.32,.98,.025,.18,'#c3b99d','soft-box','fabric')
  for(const x of [-.48,.48])add(x,.52,.22,.018,.18,.55,'#6b8581','soft-box','fabric')
 }else if(['sofa','armchair'].includes(type)){
  legs(.18,'#34312d','metal');add(0,.28,0,.94,.2,.88,paint,'soft-box','fabric')
  add(0,.7,-.38,.95,.53,.2,paint,'soft-box','fabric',[-.12,0,0])
  for(const x of [-.45,.45])add(x,.51,.01,.12,.48,.91,paint,'soft-box','fabric')
  const count=type==='armchair'?1:object.assetId==='2-seat'?2:3
  for(let i=0;i<count;i++){
   const x=(i+.5)/count*.76-.38
   add(x,.46,.07,.73/count,.2,.69,'#d3c9b7','soft-box','fabric')
   add(x,.74,-.23,.73/count,.38,.15,'#d3c9b7','soft-box','fabric',[-.16,0,0])
  }
  if(type==='sofa')for(const x of [-.3,.3])add(x,.68,-.12,.16,.24,.2,'#758d87','soft-box','fabric',[.13,0,x*.4])
  if(object.assetId==='sectional')add(.29,.46,.32,.29,.2,.35,'#d3c9b7','soft-box','fabric')
 }else if(type==='dining-chair'||type==='office-chair'){
  if(type==='office-chair'){
   add(0,.22,0,.07,.36,.07,'#6b7275','cylinder','metal')
   for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5
    add(Math.sin(angle)*.2,.08,Math.cos(angle)*.2,.05,.05,.43,'#4c5558','soft-box','metal',[0,angle,0])
   }
  }else legs(.48,'#705b43','timber',.25)
  add(0,.52,.015,.86,.12,.84,paint,'soft-box','fabric')
  add(0,.81,-.32,.91,.38,.32,'#74634e','chair-back','timber')
  add(0,.81,-.27,.77,.27,.13,paint,'soft-box','fabric',[-.12,0,0])
 }else return false
 return true
}
