import {expect,test} from 'bun:test'
import {analysisStatus} from '../src/cloud/analysisStatus'
test('reconstruction progress reports useful stages and explains a queue that is not being processed',()=>{
  expect(analysisStatus({status:'pending',job_status:'running',progress:{completed:['structure'],stages:['structure','openings'],current:'openings'}})).toContain('doors and windows')
  expect(analysisStatus({status:'pending',job_status:'queued',created_at:new Date(Date.now()-120000).toISOString()})).toContain('worker')
  expect(analysisStatus({status:'ready',job_status:'completed'})).toContain('ready to review')
})
test('empty output and provider failures are readable and cannot look like a completed model',()=>{
  expect(analysisStatus({status:'failed',job_status:'failed',failure_code:'AI_NO_STRUCTURE'})).toContain('No building was generated')
  expect(analysisStatus({status:'failed',job_status:'failed',failure_code:'AI_AUTH_FAILED'})).toContain('API key')
  expect(analysisStatus({status:'pending',job_status:'queued',failure_code:'AI_NETWORK'})).toContain('Retrying')
})
