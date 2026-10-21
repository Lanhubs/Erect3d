import type {PartBuilder} from './parts'
export function sanitaryParts({object,add,parts}:PartBuilder){
 const type=object.type,ceramic='#f0eee7',chrome='#aab5ba'
 if(type==='toilet'){
  add(0,.2,.04,.52,.4,.5,ceramic,'taper','ceramic')
  add(0,.38,.1,.98,.36,.69,ceramic,'bowl','ceramic')
  add(0,.575,.1,.99,.035,.7,'#faf8f2','ring','plastic')
  add(0,.74,-.34,.89,.5,.26,ceramic,'soft-box','ceramic')
  add(0,.99,-.34,.94,.035,.29,ceramic,'soft-box','ceramic')
  add(.22,.99,-.3,.14,.02,.07,chrome,'cylinder','metal')
 }else if(['sink','bathroom-sink','bathtub'].includes(type)){
  const tub=type==='bathtub'
  if(!tub){
   add(0,.37,0,.89,.7,.84,'#8c7760','soft-box','timber')
   for(const x of [-.22,.22])add(x,.38,.425,.41,.6,.025,'#9e896f','soft-box','timber')
   add(0,.75,0,1,.06,1,'#dfdbd1','soft-box','stone')
  }
  add(0,tub?.5:.83,0,tub?1:.78,tub?.94:.35,tub?1:.73,ceramic,'bowl','ceramic')
  add(0,tub?.12:.68,0,.12,.02,.12,chrome,'cylinder','metal')
  add(.3,1.05,-.32,.028,.22,.028,chrome,'cylinder','metal')
  add(.3,1.15,-.23,.028,.2*object.depth/object.height,.028*object.width/object.depth,chrome,'cylinder','metal',[Math.PI/2,0,0])
  for(const x of [.22,.38])add(x,1,-.32,.045,.05,.045,chrome,'cylinder','metal')
 }else if(type==='shower'){
  add(0,.025,0,1,.05,1,ceramic,'soft-box','ceramic')
  add(-.48,.51,0,.015,.98,.99,'#b4d4d5','box','glass').opacity=.22
  add(0,.51,-.48,.99,.98,.015,'#b4d4d5','box','glass').opacity=.22
  for(const x of [-.48,.48])add(x,.51,-.48,.018,.98,.018,chrome,'cylinder','metal')
  add(.28,.56,-.43,.022,.7,.022,chrome,'cylinder','metal')
  add(.28,.9,-.33,.025,.25*object.depth/object.height,.025,chrome,'cylinder','metal',[Math.PI/2,0,0])
  add(.28,.9,-.2,.18,.018,.18,chrome,'cylinder','metal')
  add(.28,.5,-.42,.12,.04,.025,chrome,'soft-box','metal')
  add(0,.052,.28,.13,.007,.13,'#7b8586','cylinder','metal')
 }else return false
 for(const part of parts)if(part.finish==='glass')part.opacity=.22
 return true
}
