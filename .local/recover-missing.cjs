const fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.cwd(),logs='C:/Users/Dell/.codex/sessions',events=[],seen=new Set(),files=new Map(),fail=[],patches=new Set(),recoverable=new Set(['client/src/intelligence/convertProposal.ts']);
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.jsonl')){
 for(const line of fs.readFileSync(p,'utf8').split('\n')){try{const x=JSON.parse(line);if(x.type==='response_item' && ['custom_tool_call','function_call'].includes(x.payload.type) && !seen.has(x.payload.call_id)) {seen.add(x.payload.call_id);events.push(x)}}catch{}}
}}}
files.set('api/src/modules/plan-analysis/conversion.ts',require('child_process').execSync('git show HEAD:api/src/modules/plan-analysis/conversion.ts',{encoding:'utf8'}));
function name(p){p=p.replaceAll('\\','/');const r=root.replaceAll('\\','/');if(p.startsWith(r+'/'))return p.slice(r.length+1);if(/^[A-Za-z]:|^\//.test(p))return null;return p;}
function patch(s){if(patches.has(s))return;patches.add(s);const lines=s.replaceAll('\r\n','\n').split('\n');for(let i=0;i<lines.length;i++){
 const m=lines[i].match(/^\*\*\* (Add|Update|Delete) File: (.+)$/);if(!m)continue;const key=name(m[2]);let body=[];while(i+1<lines.length && !lines[i+1].startsWith('*** '))body.push(lines[++i]);
 if(!key || !/^(client|api)\//.test(key) || !/\.(tsx?|css|json|html|md|sql|toml|sh)$/.test(key))continue;
 if(m[1]==='Delete'){files.delete(key);continue;}
 if(m[1]==='Add'){files.set(key,body.filter(x=>x.startsWith('+')).map(x=>x.slice(1)).join('\n')+'\n');continue;}
 if(!files.has(key))continue;let source='\n'+files.get(key),chunks=[],chunk=[],cursor=0;
 for(const l of body){if(l.startsWith('@@')){if(chunk.length)chunks.push(chunk);chunk=[]}else if(!l.startsWith('*** End'))chunk.push(l)}if(chunk.length)chunks.push(chunk);
 for(const c of chunks){const old='\n'+c.filter(x=>x[0]===' '||x[0]==='-').map(x=>x.slice(1)).join('\n')+'\n';const fresh='\n'+c.filter(x=>x[0]===' '||x[0]==='+').map(x=>x.slice(1)).join('\n')+'\n';if(old==='\n\n')source+=fresh+'\n';else if(source.indexOf(old,cursor)>=0){const offset=source.indexOf(old,cursor);source=source.slice(0,offset)+fresh+source.slice(offset+old.length);cursor=offset+fresh.length}else fail.push(key)}files.set(key,source.slice(1));
}}
(async()=>{walk(logs);events.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));for(const x of events){const p=x.payload,code=p.input||p.arguments||'';if(p.name==='apply_patch'){patch(code);continue}if(code.includes("src=Path('api/src/modules/plan-analysis/conversion.ts').read_text()") && code.includes("src=src.replace")){let src=files.get('api/src/modules/plan-analysis/conversion.ts');for(const [a,b] of [["from '../../contracts/project'","from '../domain/types'"],["from '../../contracts/analysis'","from '../../../api/src/contracts/analysis'"],["from '../../../../client/src/domain/types'","from '../domain/types'"],["from '../../../../client/src/furniture/types'","from '../furniture/types'"],["import { digest } from '../../security/tokens'\n",''],["import { ApiError } from '../../security/errors'","import { ProposalError as ApiError } from './errors'"],["from '../../../../client/src/geometry/math'","from '../geometry/math'"],["from '../../../../client/src/geometry/roomTopology'","from '../geometry/roomTopology'"],["from '../../../../client/src/domain/levels'","from '../domain/levels'"],['export function convertCandidates(','export function convertProposal('],['dimensions: { width: number; height: number }) {','dimensions: { width: number; height: number }, makeId?: (candidateId: string, suffix: string) => string) {']])src=src.replaceAll(a,b);src=src.replace(/  const entityId =[^\n]+/,"  const previewIds = new Map<string,string>()\n  const entityId=(candidateId:string,suffix='')=>{if(makeId)return makeId(candidateId,suffix);const key=candidateId+':'+suffix;if(!previewIds.has(key))previewIds.set(key,'preview_'+previewIds.size);return previewIds.get(key)!}");files.set('client/src/intelligence/convertProposal.ts',src);}
if(!code.includes('tools.apply_patch('))continue;
 const sandbox={tools:new Proxy({apply_patch:async s=>{patch(s);return{}}},{get:(o,k)=>o[k]|| (async()=>({}))}),text:()=>{},notify:()=>{},image:()=>{},store:()=>{},load:()=>{},generatedImage:()=>{},ALL_TOOLS:[]};
 try{await vm.runInNewContext('(async()=>{'+code+'})()',sandbox,{timeout:1000})}catch{}
 }
 let restored=[];for(const [key,content] of files){const dest=path.resolve(root,key);if(!dest.startsWith(root+path.sep)||(fs.existsSync(dest)&&!recoverable.has(key)))continue;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);restored.push(key)}
 fs.writeFileSync('.local/recovery-report.json',JSON.stringify({restored,unmatchedUpdates:[...new Set(fail)]},null,2));console.log('Recovered missing files:',restored.length,'; inspect .local/recovery-report.json');
})();


