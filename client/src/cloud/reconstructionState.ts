import {create} from 'zustand'
import type {AnalysisState} from './analysisStatus'
import {currentReconstructionSource,sameReconstructionSource,type ReconstructionContext} from './reconstructionContext'
export type ReconstructionState=AnalysisState & ReconstructionContext & {analysisId?:string;startedAt:number;message?:string}
export const useReconstruction=create<{current?:ReconstructionState;update:(state:ReconstructionState)=>void;clear:()=>void}>(set=>({update:current=>set({current}),clear:()=>set({current:undefined})}))
export function reconstructionUpdate(context:ReconstructionContext,state:AnalysisState,analysisId?:string,message?:string) {
  if(!currentReconstructionSource(context))return
  const previous=useReconstruction.getState().current
  const same=sameReconstructionSource(previous,context)
  if(same && analysisId && (previous!.analysisId && previous!.analysisId!==analysisId || previous!.status==='pending' && !previous!.analysisId))return
  useReconstruction.getState().update({...state,...context,analysisId,message,
    startedAt:same && (!analysisId || previous!.analysisId===analysisId || !previous!.analysisId)?previous!.startedAt:Date.now()})
}
export function reconstructionStarted(context:ReconstructionContext,analysisId:string,state:AnalysisState) {
  if(!currentReconstructionSource(context))return
  const previous=useReconstruction.getState().current
  useReconstruction.getState().update({...state,...context,analysisId,startedAt:sameReconstructionSource(previous,context)?previous!.startedAt:Date.now()})
}
export const reconstructionPhase=(state:AnalysisState,message?:string)=>state.status==='accepted'?3:message?.startsWith('Uploading')?0:1
