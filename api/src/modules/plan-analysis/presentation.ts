// Public contract: keep review data, never expose provider configuration or database internals.
export function presentAnalysis(row:any, currentPromptVersion:number) {
  const options=row.options || {}
  return {
    id:row.id,status:row.status,job_status:row.job_status,failure_code:row.failure_code,
    created_at:row.created_at,started_at:row.started_at,completed_at:row.completed_at,
    model_revision:row.model_revision,isCurrent:row.prompt_version===currentPromptVersion,
    options:Object.fromEntries(['engine','purpose','region','designMode','styleReferenceAssetId']
      .filter(key=>options[key]!==undefined).map(key=>[key,options[key]])),
    result:row.result ? {
      proposal:row.result.proposal,quality:row.result.quality,
      calibration:row.result.calibration,dimensions:row.result.dimensions
    } : null
  }
}
