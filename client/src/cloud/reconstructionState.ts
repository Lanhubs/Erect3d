import {create} from 'zustand'
import type {AnalysisState} from './analysisStatus'
export type ReconstructionState=AnalysisState & {projectId:string;analysisId?:string;startedAt:number;message?:string}
export const useReconstruction=create<{current?:ReconstructionState;update:(state:ReconstructionState)=>void}>(set=>({update:current=>set({current})}))
export function reconstructionUpdate(projectId:string,state:AnalysisState,analysisId?:string,message?:string) {
  const previous=useReconstruction.getState().current
  if(previous?.projectId===projectId && analysisId && (previous.analysisId && previous.analysisId!==analysisId || previous.status==='pending' && !previous.analysisId))return
  useReconstruction.getState().update({...state,projectId,analysisId,message,
    startedAt:previous?.projectId===projectId && (!analysisId || previous.analysisId===analysisId || !previous.analysisId)?previous.startedAt:Date.now()})
}
export function reconstructionStarted(projectId:string,analysisId:string,state:AnalysisState) {
  const previous=useReconstruction.getState().current
  useReconstruction.getState().update({...state,projectId,analysisId,startedAt:previous?.projectId===projectId?previous.startedAt:Date.now()})
}
