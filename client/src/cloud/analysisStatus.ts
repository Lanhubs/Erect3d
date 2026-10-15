const stages:Record<string,string>={
  'measure-source':'Measuring the original drawing', 'reconstruct-model':'Reading the complete plan and building its geometry',
  'reconstruct-regions':'Reading detailed regions in parallel',
  'reconstruct-region-1':'Tracing the upper-left region', 'reconstruct-region-2':'Tracing the upper-right region',
  'reconstruct-region-3':'Tracing the lower-left region', 'reconstruct-region-4':'Tracing the lower-right region',
  'global-understanding':'Reading the drawing and scale',structure:'Tracing walls and columns',
  openings:'Identifying doors and windows','rooms-labels':'Mapping rooms and labels',
  circulation:'Checking stairs and circulation','furniture-fixtures':'Reading fixtures and furniture',
  fixtures:'Reading fixed fixtures',consistency:'Checking the whole floor plan',
  'model-repair':'Connecting and validating the 3D geometry','architecture-completion':'Preparing design alternatives',
  'model-validation':'Checking and repairing the generated model',
  'validated-model-repair-1':'Correcting geometry from server checks','validated-model-repair-2':'Rechecking geometry corrections',
  'detail-1':'Reading fine details in the upper left', 'detail-2':'Reading fine details in the upper right',
  'detail-3':'Reading fine details in the lower left', 'detail-4':'Reading fine details in the lower right',
  'native-measurement-audit':'Checking fine partitions against the original pixels',
  'native-measurement-audit-1':'Checking fine partitions · batch 1', 'native-measurement-audit-2':'Checking fine partitions · batch 2',
  'native-measurement-audit-3':'Checking fine partitions · batch 3', 'native-measurement-audit-4':'Checking fine partitions · batch 4',
}
const failures:Record<string,string>={
  AI_AUTH_FAILED:'Gemini rejected the API key. Check the server’s Gemini credentials.',
  AI_MODEL_UNAVAILABLE:'The configured Gemini model is unavailable. Check the server model setting.',
  AI_QUOTA:'Gemini’s usage limit was reached. The server will retry eligible requests.',
  AI_TIMEOUT:'Interpretation timed out. Your original file and current model are preserved. You can retry.',
  AI_REQUEST_REJECTED:'The interpretation provider rejected the request format. Check the server configuration before retrying.',
  AI_NETWORK:'The server could not reach Gemini. Check its internet connection.',
  AI_SCHEMA_MISMATCH:'Gemini returned an incomplete interpretation. Start another reconstruction.',
  AI_SCHEMA_REJECTED:'Gemini rejected the interpretation schema. The server integration needs attention.',
  AI_INVALID_JSON:'Gemini returned an unreadable interpretation. Start another reconstruction.',
  AI_NO_STRUCTURE:'Gemini returned no usable walls. No building was generated; try a clearer plan or another reconstruction.',
  AI_REFUSED:'Gemini returned no interpretation for this drawing.',
  AI_UNAVAILABLE:'Gemini is not configured on this server.',
  AI_CLIENT_ERROR:'The server’s Gemini client could not complete the request. Start another reconstruction.',
  LEASE_EXHAUSTED:'Server processing was interrupted too many times. Start another reconstruction.',
  AI_UPSTREAM:'Gemini is temporarily unavailable. The server will retry eligible requests.',
  AI_IMAGE_LIMIT:'The original image exceeds the provider’s current input limit. It was kept intact; no reduced-quality copy was sent.',
}
export type AnalysisState={status:string;job_status:string;failure_code?:string;created_at?:string;
  progress?:{completed:string[];stages:string[];current:string}}
export function analysisStatus(analysis?:AnalysisState) {
  if (!analysis) return 'Loading reconstruction…'
  if (analysis.status==='failed' || analysis.job_status==='failed') return failures[analysis.failure_code || ''] || `Reconstruction failed (${analysis.failure_code || 'unknown error'}). Your current model is unchanged.`
  if (analysis.status==='cancelled') return 'Reconstruction cancelled. Your current model is unchanged.'
  if (analysis.status==='accepted') return 'Reconstruction applied. Undo restores the previous model.'
  if (analysis.status==='ready') return 'Your reconstruction is ready to review.'
  if (analysis.job_status==='queued') {
    if (analysis.failure_code) return `Retrying reconstruction. ${failures[analysis.failure_code] || analysis.failure_code}`
    if (analysis.created_at && Date.now()-Date.parse(analysis.created_at)>60000) return 'Waiting for server processing. Resume reconstruction; production deployments need the analysis worker running.'
    return 'Preparing reconstruction on the server…'
  }
  const progress=analysis.progress
  return `${stages[progress?.current || ''] || 'Interpreting the floor plan'}${progress?` · ${progress.completed.length}/${progress.stages.length} stages complete`:''}…`
}
