import type {Point} from './types'
export type BuildingTypology='house'|'duplex'|'villa'|'apartment'|'office'|'office-tower'|'hotel'|'mixed-use'|'mall'|'school'|'hospital'|'public'|'industrial'|'stadium'|'arena'|'unknown'
type Base={id:string;name:string;levelId:string;origin:'detected'|'inferred'|'user-selected';evidence:string;visible?:boolean;color:string;elevation:number}
export type EnclosureSystem=Base & {kind:'core'|'shaft';polygon:Point[];height:number;thickness:number}
export type VoidSystem=Base & {kind:'void';role:'atrium'|'courtyard'|'shaft';polygon:Point[];height:number}
export type BeamSystem=Base & {kind:'beam';start:Point;end:Point;width:number;height:number}
export type FacadeSystem=Base & {kind:'curtain-wall';path:Point[];height:number;bayWidth:number;transomHeight:number;depth:number;
  curve?:{center:Point;radius:number;startAngle:number;endAngle:number}}
export type MassingSystem=Base & {kind:'massing';role:'podium'|'tower'|'wing'|'crown'|'mechanical';polygon:Point[];holes:Point[][];height:number}
export type TypicalFloorGroup=Base & {kind:'typical-floors';templateLevelId:string;count:number;floorHeight:number;detached:Record<string,string>}
export type BuildingSystem=EnclosureSystem|VoidSystem|BeamSystem|FacadeSystem|MassingSystem|TypicalFloorGroup
export type ArchitecturalModel={version:1;typology:BuildingTypology;systems:BuildingSystem[]}
