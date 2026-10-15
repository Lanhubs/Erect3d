import { mkdtemp,readFile,rm,stat,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,relative,resolve } from 'node:path'
export async function optimizePdf(bytes: Uint8Array, executable: string | undefined, timeout: number) {
  if (!executable) return { bytes,method:'pdf-optimizer-unconfigured' }
  const root=await mkdtemp(join(tmpdir(),'erect3d-opt-')),input=join(root,'input.pdf'),output=join(root,'output.pdf')
  try {
    await writeFile(input,bytes,{ mode:0o600 })
    const process=Bun.spawn([executable,'--object-streams=generate','--stream-data=compress','--recompress-flate','--compression-level=9',input,output],{ stdout:'ignore',stderr:'ignore' })
    const timer=setTimeout(()=>process.kill(),timeout)
    let code:number;try { code=await process.exited } finally { clearTimeout(timer) }
    if (code!==0 && code!==3) return { bytes,method:'pdf-optimization-unavailable' }
    if ((await stat(output)).size>=bytes.length) return { bytes,method:'already-compact' }
    return { bytes:new Uint8Array(await readFile(output)),method:'lossless-pdf' }
  } catch { return { bytes,method:'pdf-optimization-unavailable' } }
  finally {
    if (!relative(resolve(tmpdir()),resolve(root)).startsWith('erect3d-opt-')) throw new Error('Unexpected optimizer cleanup path')
    await rm(root,{ recursive:true,force:true })
  }
}
