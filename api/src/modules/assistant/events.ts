import type {Database} from '../../db/connection'
export async function assistantEvent(db:Database,projectId:string,actorId:string,runId:string,progress:string,status?:string){
  await db`INSERT INTO realtime_events(project_id,recipient_user_id,type,payload)
    VALUES (${projectId},${actorId},'assistant.progress',${{runId,progress,status}}::jsonb)`
}
