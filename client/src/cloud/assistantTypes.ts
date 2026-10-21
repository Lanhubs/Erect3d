import type {AssistantRun,AssistantScope} from '../../../api/src/contracts/assistant'
import type {Project} from '../domain/types'
export type {AssistantRun,AssistantScope}
export type ChatMessage={id:string;run_id:string;role:'user'|'assistant';content:string}
export type Thread={messages:ChatMessage[];run:AssistantRun|null;nextCursor:string|null}
export type ChatCache=Thread&{draft:string;choice:AssistantScope['mode']|null;attach:boolean}
export type ApplyTask={runId:string;operationId:string;baseRevision:number;before:Project;historyRecorded?:boolean}
export const pendingRun=(run:AssistantRun|null)=>!!run&&['queued','running'].includes(run.status)
